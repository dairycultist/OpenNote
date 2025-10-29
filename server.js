const fs = require("fs");
const qs = require("querystring");
const { createServer } = require("node:http");
const { respondIndex, respondThread, respondImage, respond400 } = require("./respond.js");

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

var db = {};

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
            respondIndex(db, config, res, "Post data too heavy! Try again with fewer bytes!");
        },
        function (post) {

            // validate
            if (post.title == undefined || post.title.trim().length == 0) {
                respondIndex(db, config, res, "Please enter a title!");
                return;
            }

            if (post.title.trim().length > 80) {
                respondIndex(db, config, res, "Title must be >=80 characters!");
                return;
            }

            if (post.message == undefined || post.message.trim().length == 0) {
                respondIndex(db, config, res, "Please enter a message!");
                return;
            }

            // create thread with unique id
            post.title = post.title.trim();
            post.message = post.message.trim();
            
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

            respondIndex(db, config, res);
        }
    );
}

function postToThread(req, res, threadID) {

    post(
        req,
        1e7, // 10mb, maybe make this configurable later
        function () {
            respondThread(db, config, res, threadID, "Upload too heavy!");
        },
        function (post) {

            // fail if message is invalid
            if (post.message == undefined || post.message.trim().length == 0) {
                respondThread(db, config, res, req.url.substring(8));
                return;
            }

            // save images to db
            if (!Array.isArray(post.images)) {

                if (post.images.trim().length == 0) {
                    post.images = []; // images will return "" instead of an empty array when there are no images
                } else {
                    post.images = [post.images]; // images will return a string instead of an array of one string when there is one image
                }
            }

            const base64Parts = post.base64.split(";");
            base64Parts.pop(); // remove last one, which is always empty

            for (const i in base64Parts) {

                while (fs.existsSync("./db/img/" + post.images[i])) {

                    // append a random number
                    post.images[i] = Math.floor(Math.random() * 10) + post.images[i];
                }

                fs.writeFileSync("db/img/" + post.images[i], Buffer.from(base64Parts[i], "base64"));
            }

            db.threads[threadID].posts.push(
                {
                    "message": post.message,
                    "images": post.images,
                    "unixtime": Date.now()
                }
            );

            respondThread(db, config, res, threadID);
        }
    );
}

const server = createServer((req, res) => {

    try {

        // match endpoints
        if (req.url == "/") {

            switch (req.method) {
                case "GET": case "HEAD":    respondIndex(db, config, res);      break;
                case "POST":                postToIndex(req, res);  break;
                default:                    respond400(req, res);   break;
            }

        } else if (req.url.substring(0, 8) == "/thread/") {

            switch (req.method) {
                case "GET": case "HEAD":    respondThread(db, config, res, req.url.substring(8));       break;
                case "POST":                postToThread(req, res, req.url.substring(8));   break;
                default:                    respond400(req, res);                           break;
            }

        } else if (req.url.substring(0, 8) == "/db/img/") {

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

    // ensure required db directories exist
    if (!fs.existsSync("./db/img")) {

        try {
            fs.mkdirSync("./db/img", { recursive: true });
        } catch (err) {
            console.error("Error initializing database filesystem: ", err);
        }
    }

    // read server data json into program, or create it if it doesn't exist
    try {

        db = JSON.parse(fs.readFileSync("db/db.json", "utf8"));

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
            fs.writeFileSync("db/db.json", JSON.stringify(db));
            console.log("Database saved!");
        } catch (err) {
            console.error("Error saving database!");
        }

    }, config.secondsBetweenBackup * 1000);

    console.log(`Starting @ http://${config.hostname}:${config.port}/`);
});
