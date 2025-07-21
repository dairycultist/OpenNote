const fs = require("fs");
const { createServer } = require("node:http");

const hostname = "localhost";
const port = 3000;
const secondsBetweenBackup = 60;

var serverData = {};

function inject(medium, target, data) {

    return medium.replace(target, data + target);
}

const server = createServer((req, res) => {

    try {

        // match endpoints
        if (req.method == "GET" || req.method == "HEAD") {

            if (req.url == "/") {

                var indexText = fs.readFileSync("html/index.html", "utf8");

                for (const thread of serverData.threads) {

                    var threadText = fs.readFileSync("html/thread_wrapper.htm", "utf8");

                    threadText = threadText.replace("<!-- TITLE -->", thread.title);

                    for (const post of thread.posts) {

                        threadText = inject(threadText, "<!-- POSTS -->", fs.readFileSync("html/thread_post.htm", "utf8").replace("<!-- MESSAGE -->", post));
                    }

                    indexText = inject(indexText, "<!-- THREADS -->", threadText);
                }

                // respond
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(indexText);

                // TODO handle /image/ID and /thread/ID

            } else {

                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Error 400: Bad request endpoint.");
            }

        } else {

            res.writeHead(501, { "Content-Type": "text/plain" });
            res.end("Error 501: Server has no implementation to handle " + req.method + ".");
        }

    } catch (err) {

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Error 404: " + err);
    }
});

server.listen(port, hostname, () => {

    // read server data json into program, or create it if it doesn't exist
    try {

        serverData = JSON.parse(fs.readFileSync("data.json", "utf8"));

    } catch (err) {

        serverData = {
            "threads": [
                {
                    "title": "houseMD",
                    "posts": [
                        "I like beans",
                        "me 2"
                    ]
                }
            ]
        };

        try {
            fs.writeFileSync("data.json", JSON.stringify(serverData));
            console.log("Server data saved!");
        } catch (err) {
            console.error("Error backup up server data!");
        }
    }

    // TODO start async thread such that every secondsBetweenBackup seconds, server data json is saved

    console.log(`Starting @ http://${hostname}:${port}/`);
});
