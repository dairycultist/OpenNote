const fs = require("fs");
const qs = require("querystring");
const { createServer } = require("node:http");

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

var db = {};

function inject(medium, target, data) {

    return medium.replace(target, data + target);
}

function jsTimeFormat(unix) {
    return `<script>var date = new Date(${unix}); document.write(date.toLocaleDateString() + " " + date.toLocaleTimeString());</script>`;
}

function respondIndex(res, error = "") {

    var indexText = fs.readFileSync("html/index.html", "utf8");

    indexText = indexText
        .replace("<!-- ERROR -->", error)
        .replace("<!-- SITE_NAME -->", config.siteName)
        .replace("<!-- SITE_NAME -->", config.siteName)
        .replace("<!-- SITE_IMG -->", config.siteImg)
    ;

    for (const threadID in db.threads) {

        var thread = db.threads[threadID];

        var threadText =
            fs.readFileSync("html/thread_mini.htm", "utf8")
            .replace("<!-- TITLE -->", thread.title)
            .replace("<!-- ID -->", threadID)
            .replace("<ID>", threadID)
            .replace("<!-- CREATED -->", jsTimeFormat(thread.posts[0].unixtime))
            .replace("<!-- MESSAGE -->", thread.posts[0].message)
        ;

        indexText = inject(indexText, "<!-- THREADS -->", threadText);
    }

    // respond
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexText);
}

function respondThread(res, threadID, error = "") {

    var threadText = fs.readFileSync("html/thread.html", "utf8");

    threadText = threadText
        .replace("<!-- ERROR -->", error)
        .replace("<!-- SITE_NAME -->", config.siteName)
    ;

    var thread = db.threads[threadID];

    threadText = threadText
        .replace("<!-- TITLE -->", thread.title)
        .replace("<!-- TITLE -->", thread.title)
    ;

    for (const postID in thread.posts) {

        var post = thread.posts[postID];

        var postText =
            fs.readFileSync("html/thread_post.htm", "utf8")
            .replace("<!-- MESSAGE -->", post.message)
            .replace("<!-- META -->", `${jsTimeFormat(post.unixtime)} (#${postID})`)
        ;

        if (post.images != undefined)
            for (const img of post.images)
                postText = inject(postText, "<!-- IMAGES -->", "<img src='/img/" + img + "'>");

        threadText = inject(threadText, "<!-- POSTS -->", postText);
    }

    // respond
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(threadText);
}

function respondImage(res, path) {

    var image = fs.readFileSync("." + path);

    res.writeHead(200, { "Content-Type": "image/" + path.split(".").at(-1) });
    res.end(image);
}

function respond400(req, res) {

    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Error 400: Bad request endpoint\n" + req.method + " " + req.url);
}

function post(req, maxBytes, onExcessivelyHeavy, onSuccessfulRead) {

    var body = "";
    var didRespond = false;

    req.on("data", function (data) {

        body += data;

        // Too much POST data, kill the connection!
        if (!didRespond && body.length > maxBytes) {
            onExcessivelyHeavy();
            didRespond = true;
        }
    });

    req.on("end", function () {

        if (didRespond)
            return;

        onSuccessfulRead(qs.parse(body));
    });
}

function postToIndex(req, res) {

    post(
        req,
        1e6, // 1mb
        function () {
            respondIndex(res, "Post data too heavy! Try again with fewer bytes!");
        },
        function (post) {

            if (post.title == undefined || post.title.trim().length == 0) {
                respondIndex(res, "Please enter a title!");
                return;
            }

            if (post.message == undefined || post.message.trim().length == 0) {
                respondIndex(res, "Please enter a message!");
                return;
            }
            
            var threadID = 0;

            while (db.threads[threadID] != undefined) {
                threadID = Math.floor(Math.random() * 1000);
            }

            db.threads[threadID] = {
                "title": post.title,
                "posts": [
                    {
                        "message": post.message,
                        "unixtime": Date.now()
                    }
                ]
            };

            respondIndex(res);
        }
    );
}

function postToThread(req, res, threadID) {

    post(
        req,
        1e7, // 10mb, maybe make this configurable later
        function () {
            respondThread(res, threadID, "Upload too heavy!");
        },
        function (post) {

            if (!Array.isArray(post.images)) {

                if (post.images.trim().length == 0) {
                    post.images = []; // images will return "" instead of an empty array when there are no images
                } else {
                    post.images = [post.images]; // images will return a string instead of an array of one string when there is one image
                }
            }

            // maybe limit the number of images you can post per post

            const base64Parts = post.base64.split(";");
            for (const i in base64Parts) {
                fs.writeFileSync("img/" + post.images[i], Buffer.from(base64Parts[i], "base64"));
            }

            if (post.message == undefined || post.message.trim().length == 0) {
                respondThread(res, req.url.substring(8));
                return;
            }

            db.threads[threadID].posts.push(
                {
                    "message": post.message,
                    "images": post.images,
                    "unixtime": Date.now()
                }
            );

            respondThread(res, threadID);
        }
    );
}

const server = createServer((req, res) => {

    try {

        // match endpoints
        if (req.url == "/") {

            switch (req.method) {
                case "GET": case "HEAD":    respondIndex(res);      break;
                case "POST":                postToIndex(req, res);  break;
                default:                    respond400(req, res);   break;
            }

        } else if (req.url.substring(0, 8) == "/thread/") {

            switch (req.method) {
                case "GET": case "HEAD":    respondThread(res, req.url.substring(8));       break;
                case "POST":                postToThread(req, res, req.url.substring(8));   break;
                default:                    respond400(req, res);                           break;
            }

        } else if (req.url.substring(0, 5) == "/img/") {

            switch (req.method) {
                case "GET": case "HEAD":    respondImage(res, req.url); break;
                default:                    respond400(req, res);       break;
            }

        } else {

            // no endpoints matched
            respond400(req, res);
        }

    } catch (err) {

        // something went wrong, and it's not the client's fault this time!
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("500 Internal Server Error\n" + err);
    }
});

server.listen(config.port, config.hostname, () => {

    // read server data json into program, or create it if it doesn't exist
    try {

        db = JSON.parse(fs.readFileSync("db.json", "utf8"));

    } catch (err) {

        db = {
            "threads": {}
        };
    }

    // start async interval such that every secondsBetweenBackup seconds, server data json is saved
    setInterval(() => {

        var date = new Date(Date.now());
        console.log(`[${date.toLocaleDateString() + " " + date.toLocaleTimeString()}] Beginning overwrite of database file!`);

        try {
            fs.writeFileSync("db.json", JSON.stringify(db));
            console.log("Database saved!");
        } catch (err) {
            console.error("Error saving database!");
        }

    }, config.secondsBetweenBackup * 1000);

    console.log(`Starting @ http://${config.hostname}:${config.port}/`);
});
