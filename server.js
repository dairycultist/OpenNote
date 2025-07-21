const fs = require("fs");
const { createServer } = require("node:http");

const hostname = "localhost";
const port = 3000;

const server = createServer((req, res) => {
    
    // match endpoints
    if (req.method == "GET" && req.url == "/") {

        try {

            const data = fs.readFileSync("index.html", "utf8");

            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(data);

        } catch (err) {

            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Error 404: " + err);
        }

    } else {

        // default response if all else fails
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Error 400: Bad request.");
    }
});

server.listen(port, hostname, () => {

    console.log(`Starting @ http://${hostname}:${port}/`);
});
