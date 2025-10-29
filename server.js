const fs = require("fs");
const { createServer } = require("node:http");
const Get = require("./get.js");
const Post = require("./post.js");

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

var db = {};

const server = createServer((req, res) => {

    try {

        // match endpoints
        if (req.url == "/") {

            switch (req.method) {
                case "GET": case "HEAD":    Get.respondIndex(db, config, res);      break;
                case "POST":                Post.postToIndex(db, config, req, res);  break;
                default:                    Get.respond400(req, res);   break;
            }

        } else if (req.url.substring(0, 8) == "/thread/") {

            switch (req.method) {
                case "GET": case "HEAD":    Get.respondThread(db, config, res, req.url.substring(8));       break;
                case "POST":                Post.postToThread(db, config, req, res, req.url.substring(8));   break;
                default:                    Get.respond400(req, res);                           break;
            }

        } else if (req.url.substring(0, 8) == "/db/img/") {

            switch (req.method) {
                case "GET": case "HEAD":    Get.respondImage(res, req.url); break;
                default:                    Get.respond400(req, res);       break;
            }

        } else {

            // no endpoints matched
            Get.respond400(req, res);
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
