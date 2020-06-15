function recomputeViewHeights(invert) {
    invert = !!invert;
    var height = 0;
    if (invert == ($("#actions").css("display") == "none")) {
        $("#toolbar-toggle").html("<i class=\"material-icons\">keyboard_arrow_down</i>");
        $(".multieditor").css("bottom", $("#actions").height() + "px");
    }

    else {
        $("#toolbar-toggle").html("<i class=\"material-icons\">keyboard_arrow_up</i>");
        $(".multieditor").css("bottom", "0px");
    }
    editor.resize();
    editor.renderer.scrollCursorIntoView();
}
function sendEvent(textarea,type, data) {
    if (!data) 
        data = {};
    if (typeof data == "function")
        return data();
    
    var event = new Event(type);
    if (/cut|copy|paste/.test(type)) {
        event.clipboardData = {
            getData: function() { return copiedValue; },
            setData: function(mime, text) { copiedValue = text; }
        };
    }
    for (var i in data.key || {})
        event[i] = data.key[i];
    data.modifier && data.modifier.split("-").map(function(m) {
        if (m) event[m + "Key"] = true;
    });
    
    if (/input|select|composition/.test(type) || data.key && /Esc/.test(data.key.key)) {
        if (data.value != null)
            textarea.value = data.value;
        if (data.range)
            textarea.setSelectionRange(data.range[0], data.range[1]);
    }
    textarea.dispatchEvent(event); 
    
    editor.resize(true);
}
var captions = {
    "tab": "<i class='material-icons'>keyboard_tab</i>",
}
times = {}
pressed = {}
var keys = ace.require("ace/lib/keys");
var mod_key_click = function() {
    key = $(this).attr('id')
    var clickT = new Date().getTime()
    if (clickT - times[key] < 700) {
        pressed[key] = true
    }
    else {
        pressed[key] = !pressed[key]
    }
    this.style.color = pressed[key] ? "teal" : "inherit";
};

var fun_key_click = function(key) {
    var data;
    refocus.blur();
    console.log(key);
    switch(key){
        case "tab":
           data = { key: { code: "Tab", key: "Tab", keyCode: 9}};
            break;
        case "left":
            data = { key: { code: "ArrowLeft", key: "ArrowLeft", keyCode: 37}};
            break;
        case "right":
            data = { key: { code: "ArrowRight", key: "ArrowRight", keyCode: 39}};
            break;
        case "up":
            data = { key: { code: "ArrowUp", key: "ArrowUp", keyCode: 38}};
            break;
        case "down":
            data = { key: { code: "ArrowDown", key: "ArrowDown", keyCode: 40}};
            break;
           
    }
    data.modifier = pressed.shift?"shift-":""
    sendEvent(refocus,"keydown", data)
    //editor.onCommandKey({}, 0, keys($(this).attr("value")))
}
var shortcut_click = function() {
    editor.execCommand($(this).attr("id"))
}
var shortcut_click2 = function() {
    
    if (refocus) {
        refocus.removeEventListener('blur', on_blur)
        refocus = null
    }
    editor.execCommand($(this).attr("id"))

}
var refocus = false;
var chars = "tab,<,>,</,--S--;,.,comma,|,{,},[,],||,&&,--S--{--C----Y--},[--C----Y--],(--C----Y--)";

function genCharBar(char) {
    var chars = char.
    replace(/,/g, "\t").
    replace(/comma/g, ",").
    replace(/</g, "&lt;").
    replace(/>/g, "&gt;").
    replace(/'/g, "\'").
    split("\t");
    for (var i of chars) {
        var el = "<span value='"
        if (i.startsWith("--S--")) {
            i = i.replace("--S--", "");
            el += i + "' class='scroll-point'>"
        }
        else {
            el += i + "'>"
        }
        var caption = i.replace("--C--", "")
        caption = caption.replace(/--Y--/g, "")
        if (captions[caption]) {
            caption = captions[caption]
        }
        el += caption + "</span>";
        //nconsole.log(el);   		
        $("#char-bar").append(el)
    }
}
var leftToggle = "#meta-bar"
var rightToggle = "#char-bar"
var activePane = "#toolbar"

$("#toggleRight").click(function(e) {
    $(activePane).hide()
    $(rightToggle).show()
    var t = activePane
    activePane = rightToggle
    rightToggle = t
    e.stopPropagation()
})
$(leftToggle).hide()
$(rightToggle).hide()
genCharBar(chars);
$("#actions,#toolbar-toggle").on("touchstart", function() {
    if (clearRefocus) {
        clearTimeout(clearRefocus)
        clearRefocus = false
    }
    if (refocus) {

        if (refocus != document.activeElement) {
            refocus.removeEventListener('blur', on_blur)
        }
        else
            return;
    }
    refocus = document.activeElement;
    if (refocus) refocus.addEventListener('blur', on_blur)
});
var startTimeT = 0
var startX = 0,
    startY = 0
var actions = $("#actions")

function detectSwipe(e) {
    var t = e.timeStamp;
    if (e.originalEvent.touches) {
        e = e.originalEvent.touches[0];
    }
    var l = e.clientY;
    var m = e.clientX;
    var dy = l - startY
    var dx = (m - startX) * 2
    if (Math.abs(dy) > Math.abs(dx) && (t - startTimeT) < 500) {

        var vt = dy / (t - startTimeT)
        console.log(vt);
        if (vt < -0.5) {
            if (!actions.hasClass('closed')) {
                actions.addClass('closed')
                recomputeViewHeights(false)
            }
        }
        else if (vt > 0.5) {
            if (actions.hasClass('closed')) {
                actions.removeClass('closed')
                recomputeViewHeights(false)
            }
        }

    }
    startX = m
    startY = l
    startTimeT = t
}
$("#actions").on("touchmove", detectSwipe);
$("#actions,#toolbar-toggle").on("touchend",function(){
        clearRefocus = setTimeout(function() {
            refocus.removeEventListener("blur", on_blur)
            refocus = null
            clearRefocus = null;
        }, 100);
});
$("#actions .fill_box").on("scroll", function(e){
    for(var i of ["a-left","a-right","a-left","a-down"]){
        
        if($("#"+i).hasClass("pressed")){
            $("#" + i).removeClass("pressed");
        }
    }
});
$("#char-bar").on("click", "span", function(e) {
    var val = $(this).attr("value");
    if (val != "tab") {
        //necessary to clear Selection
        refocus.blur()

        var allText = refocus.value;
        if (allText === undefined)
            return

        // obtain the index of the first selected character
        var start = refocus.selectionStart;
        // obtain the index of the last selected character
        var finish = refocus.selectionEnd;
        var sel = allText.substring(start, finish);
        val = val.replace(/--Y--/g, sel)
        var cursor_pos = val.indexOf("--C--")
        val = val.replace("--C--", "")
        //append te text;
        var newText = allText.substring(0, start) + val + allText.substring(finish, allText.length);
        refocus.value = newText;
        if (cursor_pos < 0) cursor_pos = val.length
        refocus.selectionStart = refocus.selectionEnd = start + cursor_pos;
        refocus.dispatchEvent(new InputEvent("input", { data: "hield" }))
    }
    else
        fun_key_click.bind(this)(val)

    e.stopPropagation()
});
var clipboard;

$("#copy").click(function() {
    clipboard = editor.getSelectedText();
});
$("#cut").click(function() {
    clipboard = editor.getSelectedText();
    editor.insert("");
});

$("#paste").click(function() {
    editor.insert(clipboard);
});
$("#a-left").add("#a-right").add("#a-up").add("#a-down").each(
    function(e) {
        this.addEventListener('touchstart', function(e) {
            self = $(this);
            self.addClass('pressed');
            speed = 1000;
            var a = function() {
                if (self.hasClass('pressed')) {
                    speed = (500 + speed) / 11;
                    setTimeout(a, speed);
                    fun_key_click(self.attr('id').slice(2))
                }
            }
            setTimeout(a, 500);
        })
    }).each(function(e) {
    this.addEventListener('touchend', function() {
        $(this).removeClass('pressed')

    });
});
$("#find,#gotoline,#openCommandPallete").click(shortcut_click2);
$("#undo,#redo,#indent, #outdent")
    .click(shortcut_click)

$("#shift").click(mod_key_click);
$("#a-right,#a-left,#a-down,#a-up").click(function() {
    fun_key_click(this.getAttribute('id').slice(2))
});
$("#toolbar-toggle").click(function(e) {
    recomputeViewHeights(true)
    $("#actions").fadeToggle("fast");
    e.stopPropagation();
});

$("#editor").click(function(e) {
    //refocus = true;
});
$(".sidenav-trigger")[0].addEventListener("touchstart", function(e) {
    refocus = false

});
var clearRefocus = null
var on_blur = function() {
    if (refocus) {
        if (clearRefocus) {
            clearTimeout(clearRefocus)
            clearRefocus = setTimeout(function() {
            refocus.removeEventListener("blur", on_blur)
            refocus = null
            clearRefocus = null;
        }, 100);
        }
        refocus.focus();
        window.setTimeout(function() {
            if(refocus)
                refocus.focus();
        }, 0);
    }
}