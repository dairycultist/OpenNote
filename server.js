const fs = require("fs");
const qs = require("querystring");
const { createServer } = require("node:http");

const hostname = "localhost";
const port = 3000;
const secondsBetweenBackup = 60;

var db = {};

function inject(medium, target, data) {

    return medium.replace(target, data + target);
}

function respondIndex(res, error = "") {

    var indexText = fs.readFileSync("html/index.html", "utf8");

    indexText = indexText.replace("<!-- ERROR -->", error);

    for (const threadID in db.threads) {

        var thread = db.threads[threadID];

        var threadText = fs.readFileSync("html/thread_mini.htm", "utf8");

        threadText = threadText.replace("<!-- TITLE -->", thread.title);
        threadText = threadText.replace("<!-- ID -->", threadID);
        threadText = threadText.replace("<ID>", threadID);
        threadText = threadText.replace("<!-- MESSAGE -->", thread.posts[0].message);

        indexText = inject(indexText, "<!-- THREADS -->", threadText);
    }

    // respond
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexText);
}

function postToIndex(req, res) {

    var body = "";
    var didRespond = false;

    req.on("data", function (data) {

        body += data;

        // Too much POST data, kill the connection!
        if (!didRespond && body.length > 1e6) {
            respondIndex(res, "Post data too heavy! Try again with fewer bytes!");
            didRespond = true;
        }
    });

    req.on("end", function () {

        if (didRespond)
            return;

        // process post data
        var post = qs.parse(body);

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
                    "message": post.message
                }
            ]
        };

        respondIndex(res);
    });
}

function respondThread(res, threadID) {

    var threadText = fs.readFileSync("html/thread.html", "utf8");

    var thread = db.threads[threadID];

    threadText = threadText.replace("<!-- TITLE -->", thread.title);

    for (const postID in thread.posts) {

        var post = thread.posts[postID];

        var postText = fs.readFileSync("html/thread_post.htm", "utf8")
                .replace("<!-- MESSAGE -->", post.message)
                .replace("<!-- META -->", "10th 4/2025 4:20pm (#" + postID + ")");

        if (post.images != undefined)
            for (const img of post.images)
                postText = inject(postText, "<!-- IMAGES -->", "<img src='img/" + img + "'>");

        threadText = inject(threadText, "<!-- POSTS -->", postText);
    }

    // respond
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(threadText);
}

function postToThread(req, res, threadID) {

    var body = "";

    req.on("data", function (data) {

        body += data;

        // Too much POST data, kill the connection!
        if (body.length > 1e7) {
            console.log("Too much POST data, kill the connection!");
            req.socket.destroy();
            // respondThread(res, threadID, "Upload too heavy!");
        }
    });

    req.on("end", function () {

        // process post data
        var post = qs.parse(body);

        if (!Array.isArray(post.images))
            post.images = [post.images]

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
                "images": post.images
            }
        );

        respondThread(res, threadID);
    });
}

const server = createServer((req, res) => {

    try {

        // match endpoints
        if (req.url == "/") {

            switch (req.method) {
                case "GET":
                case "HEAD":
                    respondIndex(res);
                    break;
                
                case "POST":
                    postToIndex(req, res);
                    break;

                default:
                    res.writeHead(501, { "Content-Type": "text/plain" });
                    res.end("Error 501: Server has no implementation to handle " + req.method + ".");
                    break;
            }

        } else if (req.url.substring(0, 8) == "/thread/") {

            switch (req.method) {
                case "GET":
                case "HEAD":
                    respondThread(res, req.url.substring(8));
                    break;
                
                case "POST":
                    postToThread(req, res, req.url.substring(8));
                    break;

                default:
                    res.writeHead(501, { "Content-Type": "text/plain" });
                    res.end("Error 501: Server has no implementation to handle " + req.method + " " + req.url);
                    break;
            }

        } else {

            // no endpoints matched
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Error 400: Bad request endpoint\n" + req.method + " " + req.url);

            console.log("400: " + req.method + " " + req.url);
        }

    } catch (err) {

        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("500 Internal Server Error\n" + err);
    }
});

server.listen(port, hostname, () => {

    // read server data json into program, or create it if it doesn't exist
    try {

        db = JSON.parse(fs.readFileSync("db.json", "utf8"));

    } catch (err) {

        db = {
            "threads": {}
        };
    }

    // TODO start async thread such that every secondsBetweenBackup seconds, server data json is saved
    // try {
    //     fs.writeFileSync("db.json", JSON.stringify(db));
    //     console.log("Database saved!");
    // } catch (err) {
    //     console.error("Error saving database!");
    // }

    console.log(`Starting @ http://${hostname}:${port}/`);
});
