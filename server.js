const fs = require("fs");
const { createServer } = require("node:http");

const hostname = "localhost";
const port = 3000;
const secondsBetweenBackup = 60;

var db = {};

function inject(medium, target, data) {

    return medium.replace(target, data + target);
}

const server = createServer((req, res) => {

    try {

        // match endpoints
        if (req.method == "GET" || req.method == "HEAD") {

            // index.html
            if (req.url == "/") {

                var indexText = fs.readFileSync("html/index.html", "utf8");

                for (const threadID in db.threads) {

                    var thread = db.threads[threadID];

                    var threadText = fs.readFileSync("html/thread_wrapper.htm", "utf8");

                    threadText = threadText.replace("<!-- TITLE -->", thread.title);
                    threadText = threadText.replace("<!-- ID -->", threadID);

                    for (const post of thread.posts) {

                        threadText = inject(threadText, "<!-- POSTS -->", fs.readFileSync("html/thread_post.htm", "utf8").replace("<!-- MESSAGE -->", post));
                    }

                    indexText = inject(indexText, "<!-- THREADS -->", threadText);
                }

                // respond
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(indexText);

            // TODO handle /image/ID and /thread/ID

            // no endpoints matched
            } else {

                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Error 400: Bad request endpoint.");
            }
        
        } else if (req.method == "POST") {

            // process post data

            // redirect to page they came from

        // unimplemented request method
        } else {

            res.writeHead(501, { "Content-Type": "text/plain" });
            res.end("Error 501: Server has no implementation to handle " + req.method + ".");
        }

    // error reading file
    } catch (err) {

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Error 404: " + err);
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
                        "I like beans",
                        "me 2"
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
