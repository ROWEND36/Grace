ace.define("custom/linter",["require","exports","module","ace/worker/javascript"],function(require, exports, module) {
"use strict";
console.log("hello");
var oop = require("ace/lib/oop");
var lint = ace.require("ace/worker/javascript");
console.log(lint);
var Mirror = require("ace/worker/mirror").Mirror;
var lint = require("ace/mode/javascript/jshint");

var CustomLinter = exports.CustomLinter = function(sender) {
 Mirror.call(this, sender);
 this.setTimeout(500);
 this.setOptions();
};

// Mirror is a simple class which keeps main and webWorker versions of the document in sync
oop.inherits(CustomLinter, Mirror);

(function() {
 this.onUpdate = function() {
     var value = this.doc.getValue();
     var errors = [];
     var results = lint(value);

     for (var i = 0; i < results.length; i++) {
         var error = results[i];
         // convert to ace gutter annotation
         errors.push({
             row: error.line-1, // must be 0 based
             column: error.character,  // must be 0 based
             text: error.message,  // text to show in tooltip
             type: "error"|"warning"|"info"
         });
     }
     this.sender.emit("lint", errors);
 };
}).call(CustomLinter.prototype);

});
linter = ace.require("custom/linter");
this.createWorker = function(session) {

    session.on("change", function(change) {
    	console.log("hellp")
        session.setAnnotations(results.data);
    });
}
