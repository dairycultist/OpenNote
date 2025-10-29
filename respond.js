const fs = require("fs");

function inject(medium, target, data) {

    return medium.replace(target, data + target);
}

function jsTimeFormat(unix) {
    return `<script>var date = new Date(${unix}); document.write(date.toLocaleDateString() + " " + date.toLocaleTimeString());</script>`;
}

function respondIndex(db, config, res, error = "") {

    var indexText = fs.readFileSync("html/index.html", "utf8");

    indexText = indexText
        .replace("<!-- ERROR -->", error)
        .replace("<!-- SITE_NAME -->", config.siteName)
        .replace("<!-- SITE_NAME -->", config.siteName)
        .replace("<!-- SITE_IMG -->", config.siteImg)
    ;

    for (const threadID in db.threads) {

        var thread = db.threads[threadID];

        var threadText =
            fs.readFileSync("html/thread_mini.htm", "utf8")
            .replace("<!-- TITLE -->", thread.title)
            .replace("<!-- ID -->", threadID)
            .replace("<ID>", threadID)
            .replace("<!-- CREATED -->", jsTimeFormat(thread.posts[0].unixtime))
            .replace("<!-- MESSAGE -->", thread.posts[0].message)
        ;

        indexText = inject(indexText, "<!-- THREADS -->", threadText);
    }

    // respond
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexText);
}

function respondThread(db, config, res, threadID, error = "") {

    var threadText = fs.readFileSync("html/thread.html", "utf8");

    threadText = threadText
        .replace("<!-- ERROR -->", error)
        .replace("<!-- SITE_NAME -->", config.siteName)
    ;

    var thread = db.threads[threadID];

    threadText = threadText
        .replace("<!-- TITLE -->", thread.title)
        .replace("<!-- TITLE -->", thread.title)
    ;

    for (const postID in thread.posts) {

        var post = thread.posts[postID];

        var postText =
            fs.readFileSync("html/thread_post.htm", "utf8")
            .replace("<!-- MESSAGE -->", post.message)
            .replace("<!-- META -->", `${jsTimeFormat(post.unixtime)} (#${postID})`)
        ;

        if (post.images != undefined)
            for (const img of post.images)
                postText = inject(postText, "<!-- IMAGES -->", "<img src='/db/img/" + img + "'>");

        threadText = inject(threadText, "<!-- POSTS -->", postText);
    }

    // respond
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(threadText);
}

function respondImage(res, path) {

    var image = fs.readFileSync("." + path);

    res.writeHead(200, { "Content-Type": "image/" + path.split(".").at(-1) });
    res.end(image);
}

function respond400(req, res) {

    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Error 400: Bad request endpoint\n" + req.method + " " + req.url);
}

module.exports = {
	respondIndex: 	respondIndex,
	respondThread: 	respondThread,
	respondImage: 	respondImage,
	respond400: 	respond400
};