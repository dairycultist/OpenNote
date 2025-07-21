const fs = require("fs");
const { createServer } = require("node:http");

const hostname = "localhost";
const port = 3000;

const server = createServer((req, res) => {

    try {

        // match endpoints
        if (req.method == "GET" || req.method == "HEAD") {

            if (req.url == "/") {

                const data = fs.readFileSync("index.html", "utf8");

                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(data);

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
