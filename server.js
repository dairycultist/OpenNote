const fs = require("fs");
const { createServer } = require("node:http");

const hostname = "localhost";
const port = 3000;

// replacements and "injections" (the string is placed before the target string instead of replacing it)
// inject _ with _ before _
function inject(medium, target, data) {

    return medium.replace(target, data + target);
}

const server = createServer((req, res) => {

    try {

        // match endpoints
        if (req.method == "GET" || req.method == "HEAD") {

            if (req.url == "/") {

                var index = fs.readFileSync("html/index.html", "utf8");

                for (var i = 0; i < 10; i++) {

                    var thread = fs.readFileSync("html/thread_wrapper.htm", "utf8");

                    for (var j = 0; j < 3; j++) {
                        thread = inject(thread, "<!-- POSTS -->", fs.readFileSync("html/thread_post.htm", "utf8"));
                    }

                    index = inject(index, "<!-- THREADS -->", thread);
                }

                // respond
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(index);

                // TODO handle /image /thread

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

    console.log(`Starting @ http://${hostname}:${port}/`);
});
