const { createServer } = require('node:http');

const hostname = "127.0.0.1";
const port = 3000;

const server = createServer((req, res) => {
    
    // match endpoints
    if (req.method == "GET" && req.url == "/") {

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("hello");

    } else {

        // default response if all else fails
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Error 400: Bad request.");
    }
});

server.listen(port, hostname, () => {

    console.log(`Starting @ http://${hostname}:${port}/`);
});
