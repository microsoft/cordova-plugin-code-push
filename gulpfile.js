var gulp = require("gulp");

gulp.task("compile", function () {
	var ts = require("gulp-typescript");
	var tsCompileOptions = { "noImplicitAny": true, "noEmitOnError": true, "target": "ES5", "module": "commonjs", "sourceMap": false, "sortOutput": true };
	return gulp.src(["./ts/**/*.ts"])
		.pipe(ts(tsCompileOptions))
		.pipe(gulp.dest("./www"));
});

gulp.task("tslint", function () {
	var tslint = require('gulp-tslint');
	
	// Configuration options adapted from TypeScript project:
	// https://github.com/Microsoft/TypeScript/blob/master/tslint.json
	
	var config = {
		"rules": {
			"class-name": true,
			"comment-format": [true,
				"check-space"
			],
			"indent": [true,
				"spaces"
			],
			"one-line": [true,
				"check-open-brace"
			],
			"no-unreachable": true,
			"no-use-before-declare": true,
			"quotemark": [true,
				"double"
			],
			"semicolon": true,
			"whitespace": [true,
				"check-branch",
				"check-operator",
				"check-separator",
				"check-type"
			],
			"typedef-whitespace": [true, {
				"call-signature": "nospace",
				"index-signature": "nospace",
				"parameter": "nospace",
				"property-declaration": "nospace",
				"variable-declaration": "nospace"
			}]
		}
	}

	return gulp.src("./ts/**/*.ts")
		.pipe(tslint({ configuration: config }))
		.pipe(tslint.report("verbose"));
});

gulp.task("clean", function (callback) {
	var del = require("del");
	del(["./www/**"], { force: true }, callback);
});

gulp.task("default", function (callback) {
	var runSequence = require("run-sequence");
	runSequence("clean", "compile", "tslint");
}); 