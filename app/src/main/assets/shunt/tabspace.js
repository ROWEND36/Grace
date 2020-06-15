// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  CodeMirror.defineOption("showTabSpaces", false, function(cm, val, prev) {
  	if (prev == CodeMirror.Init) prev = false;
  	var last = false;
    if (prev && !val)
      cm.removeOverlay("tabspace");
    else if (!prev && val)
      cm.addOverlay({
      	opaque:true,
        token: function(stream) {
          
          var l = stream.string.length;
          if(l<=stream.pos)return null;
          
          if(stream.string.slice(stream.pos,stream.pos+4)=="    ")
          	{
          		stream.pos+=4;
          		if(last=!last)
          			return "spacetabs";
          		else
          			return "spacetabs2";
          	}
          
          stream.pos = l;
          return null;
        },
        name: "tabspace"
      });
  });
});