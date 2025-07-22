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

function respondThread(res, threadID) {

    var threadText = fs.readFileSync("html/thread.html", "utf8");

    var thread = db.threads[threadID];

    threadText = threadText.replace("<!-- TITLE -->", thread.title);
    threadText = threadText.replace("<!-- ID -->", threadID);

    for (const postID in thread.posts) {

        var post = thread.posts[postID];

        threadText = inject(
            threadText,
            "<!-- POSTS -->",
            fs.readFileSync("html/thread_post.htm", "utf8")
                .replace("<!-- MESSAGE -->", post.message)
                .replace("<!-- META -->", "10th 4/2025 4:20pm (#" + postID + ")")
        );
    }

    // respond
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(threadText);
}

const server = createServer((req, res) => {

    try {

        // match endpoints
        if (req.method == "GET" || req.method == "HEAD") {

            if (req.url == "/") {

                respondIndex(res);

            } else if (req.url.substring(0, 8) == "/thread/") {

                respondThread(res, req.url.substring(8));

            } else {

                // no endpoints matched
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Error 400: Bad request endpoint\n" + req.method + " " + req.url);
            }
        
        } else if (req.method == "POST") {

            var body = "";

            req.on("data", function (data) {

                body += data;

                // Too much POST data, kill the connection!
                if (body.length > 1e6)
                    req.socket.destroy();
            });

            req.on("end", function () {

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

        // unimplemented request method
        } else {

            res.writeHead(501, { "Content-Type": "text/plain" });
            res.end("Error 501: Server has no implementation to handle " + req.method + ".");
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
            "threads": {
                "0": {
                    "title": "houseMD",
                    "posts": [
                        {
                            "message": "I like beans"
                        },
                        {
                            "message": "me 2"
                        }
                    ]
                }
            }
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
