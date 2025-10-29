const fs = require("fs");
const qs = require("querystring");
const { respondIndex, respondThread } = require("./get.js");

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

function postToIndex(db, config, req, res) {

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

function postToThread(db, config, req, res, threadID) {

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

module.exports = {
	postToIndex: 	postToIndex,
	postToThread: 	postToThread
};