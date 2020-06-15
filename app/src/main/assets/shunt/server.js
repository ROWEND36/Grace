var express = require("express");
var fs = require("fs");
var debugStatic = require("./debugStatic.js");
var files = require("./fileServer.js");
var app = express();
app.use(express.bodyParser());
const sendHtml = function(res, html) {
res.setHeader('Content-Type', 'text/html');
res.setHeader('Content-Length', Buffer.byteLength(html));
res.end(html);
console.log(html);
};
app.set('port', process.env.PORT || 3000);
// custom 404 page
app.get("/files",function(req,res){
	console.log(req.query);
	files.getFileList(res,req.query.dir);
	});
app.post("/rename",function(req,res){
	console.log(req.body);
	fs.rename(req.body.path,req.body.dest,function(e){
		if(e){
			res.status(500);
			res.end();
			}
		else{
			res.status(200);
			res.end();
			}
		});
	});
app.post("/delete",function(req,res){
	fs.unlink(req.body.path,function(e){
		if(e){
			res.status(500);
			res.end();
			}
			else{
				res.status(200);
				res.end();
				}
		})
	});
app.get("/open",function(req,res){
	fs.readFile(req.query.file,function(e,str){
	    res.send(str);
	});
});
app.post("/save",function(req,res){
	console.log(req.body.path);
	files.saveFile(req.body);
	res.status(200);
	res.end();
});
app.get("/",function(req,res){
	sendHtml(res,fs.readFileSync("./index.html"));
});
//app.use(express.static(__dirname));
app.use(debugStatic.static("./"));
// custom 500 page
app.use(function(err, req, res, next){
	console.error(err.stack);
	res.type('text/plain');
	res.status(500);
	res.send('500 - Server Error');
	});
	
app.listen(app.get('port'), function(){
  console.log( 'Express started on http://localhost:' +
  app.get('port') + '; press Ctrl-C to terminate.' );
  });
