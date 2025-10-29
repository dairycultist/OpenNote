const fs = require("fs");
const qs = require("querystring");
const multiparty = require("multiparty");
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
            if (post.message == undefined || post.message.trim().length == 0) {
                respondIndex(db, config, res, "Please enter a message!");
                return;
            }

            // create thread with unique id
            var threadID = 0;

            while (db.threads[threadID] != undefined)
                threadID = Math.floor(Math.random() * 1000);

            db.threads[threadID] = {
                "title": "",
                "posts": [
                    {
                        "message": post.message.trim(),
                        "unixtime": Date.now()
                    }
                ]
            };

            respondIndex(db, config, res);
        }
    );
}

function postToThread(db, config, req, res, threadID) {

	// https://www.npmjs.com/package/multiparty
    var form = new multiparty.Form({ autoFiles: true, uploadDir: "./db/img/" });

	form.parse(req, function(err, fields, files) {

		console.log(fields);
		console.log(files);

		// fail if message is invalid
		if (fields.message == undefined || fields.message.length != 1 || fields.message[0].trim().length == 0) {
			respondThread(db, config, res, req.url.substring(8), "Something unexpected happened!");
			return;
		}

		let images = [];

		for (const file of files.images) {

			if (file.size > 0) {
				images.push(file.path.substring(file.path.lastIndexOf("/") + 1));
			} else {
				// multiparty will make a 0-byte file if no file is passed through the request, just delete it
				fs.unlinkSync("./" + file.path);
			}
		}

		db.threads[threadID].posts.push(
			{
				"message": fields.message[0],
				"images": images,
				"unixtime": Date.now()
			}
		);

		respondThread(db, config, res, threadID);
	});
}

module.exports = {
	postToIndex: 	postToIndex,
	postToThread: 	postToThread
};