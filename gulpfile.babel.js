import gulp from "gulp";
import uglify from "gulp-uglify";
import sourcemaps from "gulp-sourcemaps";
import sass from "gulp-sass";
import concatCSS from "gulp-concat-css";
import gutil from "gulp-util";
import template from "gulp-template";
import rename from "gulp-rename";

import browserify from "browserify";
import babelify from "babelify";
import watchify from "watchify";

import source from "vinyl-source-stream";
import buffer from "vinyl-buffer";

import browserSync from "browser-sync";
import del from "del";

//////////////////////////////////////////////////////////////
// UTILS
//////////////////////////////////////////////////////////////

function log (color, ...text) {
	gutil.log(gutil.colors[color](...text));
}

function watch (sourceFiles, gulpTasks) {
	gulp.watch(sourceFiles, gulpTasks).on("error", () => {});
}

// return the string contents of a file, or undefined if there was an error reading the file
function getFile (path) {
	try {
		return fs.readFileSync(path, { encoding: "utf-8" });
	} catch (error) {
		log("yellow", `File '${path}' was not found. Returning 'undefined'.`);
		return undefined;
	}
}

// return JSON read from a file
function readJSON (path) {
	let file = getFile(path);
	return file ? JSON.parse(file) : {};
}

//////////////////////////////////////////////////////////////
// CONSTANTS
//////////////////////////////////////////////////////////////

const paths = {
	src: {
		entry: "./src/js/index.js",
		js: "./src/js/**/*.js",
		scss: "./src/scss/**/*.scss",
		html: "./src/html/**/*.html"
	},
	build: {
		dir: "./build/",
		js: "./build/*.js"
	},
	sourcemaps: "./maps"
};

const pkg = readJSON('./package.json');
const browser = browserSync.create();
const jsBundle = "./app.js";
const cssBundle = "./app.css";

//////////////////////////////////////////////////////////////
// TASKS
//////////////////////////////////////////////////////////////

gulp.task("js", function () {
	const b = watchify(
		browserify({
			entries: paths.src.entry,
			debug: true,
			transform: [ babelify.configure({ presets: [ "env" ]})]
		})
	);

	function bundle () {
		return b.bundle().on("error", gutil.log.bind(gutil, "Browserify Error"))
			.pipe(source(jsBundle))
			.pipe(buffer())
			.pipe(sourcemaps.init({ loadMaps: true }))
			.pipe(uglify()).on("error", gutil.log)
			.pipe(sourcemaps.write(paths.sourcemaps))
			.pipe(gulp.dest(paths.build.dir));
	}

	b.on("update", bundle);
	b.on("log", gutil.log);
	return bundle();
});

gulp.task("css", function () {
	const outputStyle = "compressed";
	return gulp.src(paths.src.scss)
	  .pipe(sourcemaps.init())
	  .pipe(sass({ outputStyle }).on("error", sass.logError))
		.pipe(concatCSS(cssBundle))
	  .pipe(sourcemaps.write(paths.sourcemaps))
	  .pipe(gulp.dest(paths.build.dir));
});

gulp.task("html", function () {
	const templates = {
		title: pkg.name,
		jsBundle, cssBundle
	};
	return gulp.src(paths.src.html)
		.pipe(template(templates))
		.pipe(rename("index.html"))
		.pipe(gulp.dest(paths.build.dir));
});

gulp.task("reload", function (done) {
	browser.reload();
	done();
});

gulp.task("watch", function () {
	watch(paths.build.js, gulp.series("reload"));
	watch(paths.src.scss, gulp.series("css", "reload"));
	watch(paths.src.html, gulp.series("html", "reload"));
});

gulp.task("serve", function () {
	browser.init({ server: { baseDir: paths.build.dir } });
});

gulp.task("clean", function () {
	return del([`${paths.build.dir}*`], { force: true });
});

gulp.task("compile", gulp.parallel("clean", "js", "css", "html"));
gulp.task("build", gulp.series(
	"compile",
	function exit () { process.exit(0); }
));
gulp.task("dev", gulp.series(
	"compile",
	gulp.parallel("serve", "watch")
));
