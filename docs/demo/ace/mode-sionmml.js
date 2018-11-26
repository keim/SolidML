// highlight
ace.define("ace/mode/sionmml_highlight_rules", function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var rules = function() {
        this.$rules = {
            "start": [
                { include : "comment-module"},
                { token : "keyword", regex : /(#REV|#END)\s*;/},
                { token : "keyword", regex : /#[A-Z]+\+?=/},
                { token : "entity.name.function", regex : /[A-Z]/},
                { token : "keyword", regex : /;/},
                { token : ["keyword","constant.numeric","keyword"], regex : /(#QUANT|#FPS)(\s*\d+)(;)/},
                { token : "keyword", regex : /(#TITLE|#SIGN|#MACRO|#VMODE|#TMODE|#FM|#LOADSOUND)/, next : "before-system"},
                { token : ["keyword","constant.numeric"], regex : /(#EFFECT)(\s*\d+)/, next : "before-system"},
                { token : ["keyword","constant.numeric"], regex : /(#SAMPLER|#PCMWAVE|#PCMVOICE)(\s*\d+)/, next : "before-system"},
                { token : ["keyword","constant.numeric"], regex : /(#TABLE|#WAVB|#WAV|#WAVCOLOR|#WAVC)(\s*\d+)/, next : "before-system"},
                { token : ["keyword","constant.numeric"], regex : /(#OPL@|#OPM@|#OPN@|#OPX@|#MA@|#@|#PRESET@)(\s*\d+)/, next : "before-system"},
                { token : "support.function", regex : /\$|&&|&/},
                { token : ["support.function","constant.numeric"], regex : /(%v|%x|%f|%t|%e|%)([\d,]*)/},
                { token : ["support.function","constant.numeric"], regex : /(@fps|@lfo|mp|ma|@mask|@i|@o|@r|@q|q|@p|p|s|@v|v|x|o|i|@k|k|_@@|_na|_np|_nt|_nf|@@|na|np|nt|nf)([\d,]*)/},
                { token : ["support.function","constant.numeric"], regex : /(l)([\d.^]*)/},
                { token : ["support.function","constant.numeric"], regex : /([<>()])([\d]*)/},
                { token : ["support.function","constant.numeric"], regex : /([[|\]])([\d]*)/},
                { token : ["support.function","constant.numeric"], regex : /(@fx|@ph|@se|@er|@dt|@ml|@tl|@rr|@fb|@al|@f|@)([\d,]*)/}
            ],
            "before-system" : [
                { include : "comment-module"},
                { token : "string.system", regex : /\{/, next : "system"}
            ],
            "system" : [
                { include : "comment-module"},
                { token : "string.system", regex : /\}/, next : "start"},
                { defaultToken : "string.system"}
            ],
            "comment-module" : [
                { token : "comment.line.double-slash", regex : /\/\/.*$/},
                { token : "comment.block", regex : /\/\*/, push : "comment-block" }
            ],
            "comment-block": [
                { token : "comment.block", regex : /\*\//, next : "pop"},
                { defaultToken : "comment.block"}
            ]
        }
        this.normalizeRules();
    };
    oop.inherits(rules, require("./text_highlight_rules").TextHighlightRules);
    exports.SiONMMLHighlightRules = rules;
});



// folding mode
ace.define("ace/mode/folding/sionmml",["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode","ace/range"], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var BaseFoldMode = require("./fold_mode").FoldMode;
var Range = require("../../range").Range;

var FoldMode = exports.FoldMode = function() {};
oop.inherits(FoldMode, BaseFoldMode);

(function() {
    this.foldingStartMarker = /(\{)[^\}]*$|^\s*(\/\*)/;
    this.foldingStopMarker = /^[^\{]*(\})|^[\s\*]*(\*\/)/;

    this.getFoldWidgetRange = function(session, foldStyle, row) {
        var line = session.getLine(row);

        // bracket block
        var match = line.match(this.foldingStartMarker);
        if (match) {
            if (match[1]) return this.openingBracketBlock(session, match[1], row, match.index);
            var range = session.getCommentFoldRange(row, match.index + match[0].length);
            range.end.column -= 2;
            return range;
        }

        // indent block
        var range = this.indentationBlock(session, row);
        if (range) return range;

        // folding mark ----
        var maxRow = session.getLength();
        var startColumn, endColumn, startRow = row, endRow = row, m;

        if (/^\/\/.*----/.test(line)) {
            startColumn = line.length;
            while (++endRow < maxRow)
                if ((endColumn = session.getLine(endRow).search(/^^\/\/.*----/)) != -1) break;
            while (--endRow >= startRow)
                if (!/^\s*$/.test(session.getLine(endRow))) break;
            endColumn = session.getLine(endRow).length;
            return new Range(startRow, startColumn, endRow, endColumn);
        } else if (m = line.match(/^#[A-Z]+\+?=/)) {
            startColumn = m[0].length;
            while (++endRow < maxRow)
                if ((endColumn = session.getLine(endRow).search(/;/)) != -1) break;
            return new Range(startRow, startColumn, endRow, endColumn);
        }
    };

    this.getFoldWidget = function(session, foldStyle, row) {
        var line = session.getLine(row),
            indent = line.search(/\S/), m;
        if (indent == -1) return '';
        if (this.foldingStartMarker.test(line)) return "start";
        if (/^\/\/.*----/.test(line)) return 'start';
        if (/^#[A-Z]+\+?=[^;]+$/.test(line)) return 'start';
        var ni = session.getLine(row+1).search(/\S/);
        if (ni!=-1 && ni>indent) return 'start';
        return '';
    };

}).call(FoldMode.prototype);

});



// mode
ace.define("ace/mode/sionmml", function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");

    var SiONMMLHighlightRules = require("./sionmml_highlight_rules").SiONMMLHighlightRules;
    var FoldMode = require("./folding/sionmml").FoldMode;

    var mode = function() {
        this.HighlightRules = SiONMMLHighlightRules;
        this.foldingRules = new FoldMode();
    };
    oop.inherits(mode, require("./text").Mode);
    exports.Mode = mode;
});