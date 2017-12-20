import gulp from 'gulp';
import sourcemaps from 'gulp-sourcemaps';
import sass from 'gulp-sass';
import cleanCSS from 'gulp-clean-css';
import autoprefixer from 'gulp-autoprefixer';
import gutil from 'gulp-util';
import template from 'gulp-template';
import rename from 'gulp-rename';

import browserify from 'browserify';
import watchify from 'watchify';

import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';

import browserSync from 'browser-sync';
import del from 'del';

//////////////////////////////////////////////////////////////
// UTILS
//////////////////////////////////////////////////////////////

function log (color, ...text) {
	gutil.log(gutil.colors[color](...text));
}

function watch (sourceFiles, gulpTasks) {
	gulp.watch(sourceFiles, gulpTasks).on('error', () => null);
}

// return the string contents of a file, or undefined if there was an error reading the file
function getFile (path, cb) {
	const logErr = () => log('yellow', `File '${path}' was not found. Returning 'undefined'.`);
	if (cb) {
		fs.readFile(path, (err, data) => cb(err ? logErr() : data));
	} else {
		try { return fs.readFileSync(path, { encoding: 'utf-8' }); } catch (err) { return logErr(); }
	}
}

//////////////////////////////////////////////////////////////
// CONSTANTS
//////////////////////////////////////////////////////////////

const pkg = require('./package.json');
const browser = browserSync.create();
const paths = {
	src: {
		entry: './src/js/index.js',
		js: './src/js/**/*.js',
		scss: './src/scss/**/*.scss',
		html: './src/html/**/*.html'
	},
	build: {
		dir: './build/',
		js: './build/*.js',
		jsBundleName: 'app.js',
		cssBundleName: 'app.css',
		sourcemaps: './maps',
	},
};
const env = {
	PROD: 'production',
	DEV: 'development',
	get isProd() { return process.env.NODE_ENV === this.PROD; },
	get isDev() { return process.env.NODE_ENV === this.DEV; }
}
if (process.env.NODE_ENV === undefined) {
	process.env.NODE_ENV === env.DEV;
}

//////////////////////////////////////////////////////////////
// TASKS
//////////////////////////////////////////////////////////////

function bundle (entryFile, bundleName) {
	const debug = env.isDev;
	const opts = {
		debug,
		entries: entryFile,
		transform: ['babelify']
	};
	// only minify for prod
	if (!debug) { opts.plugin = ['tinyify']; }

	let b;
	// only use watchify for debugging
	if (debug) {
		// extend with watchify args for caching
		Object.keys(watchify.args).forEach(key => opts[key] = watchify.args[key]);
		b = watchify(browserify(opts));
	} else {
		b = browserify(opts);
	}

	function doBundle () {
		return b.bundle().on('error', gutil.log)
			.pipe(source(bundleName || entryFile))
			.pipe(buffer())
			// only use sourcemaps for dev builds
			.pipe(debug ? sourcemaps.init({ loadMaps: true }) : gutil.noop())
			.pipe(debug ? sourcemaps.write(paths.build.sourcemaps) : gutil.noop())
			.pipe(gulp.dest(paths.build.dir));
	}

	b.on('update', doBundle);
	b.on('log', gutil.log);

	return doBundle();
}

gulp.task('js', () => bundle(paths.src.entry, paths.build.jsBundleName));

gulp.task('css', () =>
	gulp.src(paths.src.scss)
		.pipe(env.isDev ? sourcemaps.init() : gutil.noop())
		.pipe(sass({ importer: sassModuleImporter() }).on('error', sass.logError))
		.pipe(autoprefixer())
		.pipe(env.isProd ? cleanCSS() : gutil.noop())
		.pipe(rename(paths.build.cssBundleName))
		.pipe(env.isDev ? sourcemaps.write(paths.build.sourcemaps) : gutil.noop())
		.pipe(gulp.dest(paths.build.dir))
);

gulp.task('html', () =>
	gulp.src(paths.src.html)
		.pipe(template({
			title: pkg.name,
			jsBundleName: `./${paths.build.jsBundleName}`,
			cssBundleName: `./${paths.build.cssBundleName}`
		}))
		.pipe(rename('index.html'))
		.pipe(gulp.dest(paths.build.dir))
);

gulp.task('reload', cb => {
	browser.reload();
	cb();
});

gulp.task('watch', () => {
	watch(paths.build.js, gulp.series('reload'));
	watch(paths.src.scss, gulp.series('css', 'reload'));
	watch(paths.src.html, gulp.series('html', 'reload'));
});

gulp.task('serve', () => {
	browser.init({
		host: 'localhost',
		port: 3000,
		server: paths.build.dir,
		ghostMode: false,
		logLevel: 'info',
		logPrefix: pkg.name
	});
});

gulp.task('clean', () => del([`${paths.build.dir}*`], { force: true }));

gulp.task('build',
	gulp.parallel(
		'clean',
		'js',
		'css',
		'html'
	)
);

gulp.task('default',
	gulp.series(
		'build',
		gulp.parallel(
			'serve',
			'watch'
		)
	)
);
