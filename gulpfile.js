'use strict';

/*
 * Менеджер подключений
 */

// packages imports, все их сначала надо установить через:  npm install packagename --save-dev
var gulp = require('gulp'),  // импортирую галп
  path = require('path'),  // импортирую пакет для работы с путями файлов:  https://nodejs.org/docs/latest/api/path.html
  glob = require('glob'),  // импортирую пакет для глобальных переменных:  https://www.npmjs.com/package/glob
  rename = require('gulp-rename'), // импортирую пакет для переименования:  https://www.npmjs.com/package/gulp-rename
  es = require('event-stream'),  // импортирую пакет для работы с потоками:  node.js https://www.npmjs.com/package/event-stream
  cssnano = require('gulp-cssnano'),  // минимизатор css:  https://www.npmjs.com/package/cssnano  http://cssnano.co/usage/
  uglify = require('gulp-uglify'),  // минимизатор js:  https://www.npmjs.com/package/gulp-uglify
  minimist = require('minimist'),  // импортирую пакет для вытаскивания значений флагов из введённой в консоли команды:  http://ricostacruz.com/cheatsheets/minimist.html  https://www.npmjs.com/package/minimist
  filter = require('gulp-filter'),  // импортирую пакет, который позволяет фильтровать файлы в потоке через регулярки:  https://www.npmjs.com/package/gulp-filter
  lazypipe = require('lazypipe'),  // импортирую пакет для создания независимых пайплайнов задач, в которые можно в любой момент переходить из основного:  https://www.npmjs.com/package/lazypipe
  chmod = require('gulp-chmod'),  // импортирую выставлялку прав на файлы:  https://www.npmjs.com/package/gulp-chmod
  gPrint = require('gulp-print'),  // импортирую вывод сообщений внутри gulp.pipe():  https://www.npmjs.com/package/gulp-print
  del = require('del'),  // импортирую пакет для удаления файлов:  https://www.npmjs.com/package/del
  gitStatus = require('gulp-git-status'),  // импортирую пакет для работы с гит-статусами файлов:  https://www.npmjs.com/package/gulp-git-status
  gulpIf = require('gulp-if');  // условный оператор для использования внутри gulp.pipe():  https://www.npmjs.com/package/gulp-if

/*
 * Настройки
 */

// CLI options | опции(флаги) шелла
// создаём объект, в котором описываем все наши опции-флаги, чтобы потом скормить его minimist'у (это взято из мануала minimist)
var knownOptions = {
  // закомментированные - пока не используются!
  string: [  // строковые консольные флаги
    'cli_folder',  // для указания папки, к которой применить команду  --cli_folder=somefolder/subfolder/
    'cli_file',  // для указания файла, к которому применить команду  --cli_file=somefile.ext
    'cli_path',  // для указания полного пути к файлу, к которому применить команду  --cli_path='./somefolder/subfolder/somefile.ext'
    'chmod'  // для указания прав на создаваемые файлы
  ],
  boolean: [  // булевы консольные флаги
    //'production',  // флаг для определения дев или продакшен, не знаю, может пригодиться...   --production / --no-production
    'excludes',  // флаг для обработки папок, которые в обычном режиме добавлены в исключения
    //'watch',  // флаг для установки watchera на таски  --watch / --no-watch
    //'backup',  // флаг для бэкапа  --backup / --no-backup
    //'compress',  // флаг для компрессии  --compress / --no-compress
    //'beautify',  // флаг для созданий файла с красивым кодом  --beautify / --no-beautify
    'git_modified',  // флаг для отслеживания файлов, у которых в Git репозитории статус 'modified'
    'git_changed'  // флаг для отслеживания файлов, у которых в Git репозитории статус 'modified' или 'untracked' 
  ],
  alias: {  // алиасы, т.е. укороченные имена для флагов
    //'prod': 'production',
    'dir': 'cli_folder',
    'f': 'cli_file',
    'p': 'cli_path',
    'exc': 'excludes',
    'chm': 'chmod',
    //'w': 'watch',
    //'bu': 'backup',
    //'min': 'compress',
    //'btf': 'beautify',
    'gimn': 'git_modified_new',
    'gim': 'git_modified'
  },
  default: {  // дефолтные значения флагов
    //'production': false,
    'excludes': true,
    //'watch': false,
    //'backup': false,
    'chmod': 755,
    //'compress': false,
    //'beautify': false,
    'git_modified_new': false,
    'git_modified': false
  }
};

var options = minimist(process.argv.slice(2), knownOptions);  // записываем все наши опции в переменную

// Теперь можем к ним обращаться через options.optioname:
console.log('\nACTIVE OPTIONS');
//console.log('options.production = ' + options.prod);
console.log('options.cli_folder = ' + options.dir);
console.log('options.cli_file = ' + options.f);
console.log('options.cli_path = ' + options.p);
console.log('options.excludes = ' + options.exc);
//console.log('options.watch = ' + options.w);
//console.log('options.backup = ' + options.bu);
console.log('options.chmod = ' + options.chmod);
//console.log('options.compress = ' + options.min);
//console.log('options.beautify = ' + options.btf);
console.log('options.git_modified_new = ' + options.gimn);
console.log('options.git_modified = ' + options.gim);
console.log('-------------------------------');

// Глобальные переменные путей
var thisPath = path.resolve(),  // возвращает строку с абсолютным путём к текущей папке, где лежит этот файл
  templatesRelPath = './projectroot/templates/',  // относительный путь к вашей папке темплейтов
  staticPath = './projectroot/static/',  // относительный путь к вашей папке статики
  devRelPath = './projectroot/static/source/',  // относительный путь к вашей папке статики для разработки
  buildRelPath = './projectroot/static/build/';  // относительный путь к вашей папке статики для продакшена

/* Учтём возможность необходимости исключать какие-либо папки из процесса */
// выбираем папки сторонних django-аппов,
var patternDjangoApps = '+(admin|rest_framework|appname3|appname4)';
var patternDjangoAppsFolders = '';
var patternDjangoAppsFiles = '';
if (options.excludes) {  // при желании их обработку можно будет отключить через флаг --no-exc в командной строке
  // в данном случае предполагается что аппы лежат в ./static/dev/_здесь_  - меняйте под свой проект.
  patternDjangoAppsFolders = devRelPath + patternDjangoApps;
  patternDjangoAppsFiles = devRelPath + patternDjangoApps + '/**/*';
}
// выбираем остальные расположения, которые будем исключать, и файлы в них 
var patternExcluded = '+(node_modules|bower_components|backup)/';
var patternExcludedFolders = devRelPath + '**/*' + patternExcluded;
var patternExcludedFiles = patternExcludedFolders + '/**/*';  // другие папки, которые всегда нужно игнорировать на любых уровнях


/*
 * Gulp - таски 
 */

gulp.task('build:css_js', function() {
  // для начала опишем различные поисковые паттерны через регулярки:
  var patternFolder = '**/';  // ищем во всех вложенных папках

  var patternFileCss = '*.css';  // ищем любые CSS файлы
  var patternFileJs = '*.js';  // ищем любые JS файлы
  var patternFileCssJs = '*.*(js|css)';  // ищем любые CSS или JS  файлы

  var patternFileCssNotMin = '!(*\.min).css';  // ищем любые неминифицированные CSS файлы
  var patternFileCssOnlyMin = '*.min.css'; // ищем только минифицированные CSS файлы
  var patternFileJsNotMin = '!(*\.min).js';  // ищем любые неминифицированные JS файлы
  var patternFileJsOnlyMin = '*.min.js'; // ищем только минифицированные JS файлы
  var patternFileCssJsNotMin = '!(*\.min).*(js|css)';  // любые CSS и JS без суффикса .min
  var patternFileCssJsOnlyMin = '*.min.*(css|js)';  // только .min.css или .min.js
  
  var patternCss = devRelPath + patternFolder + patternFileCss;  // выбираю все css-ники во всех папках внутри /static/dev/ (папка для разработки)
  var patternJs = devRelPath + patternFolder + patternFileJs;  // выбираю все js-ники во всех папках внутри /static/dev/
  var patternCssJs = devRelPath + patternFolder + patternFileCssJs;  // выбираю все css и js файлы внутри /static/dev/
  //var patternCssJsNotMin = devRelPath + patternFolder + patternFileCssJsNotMin;  // а вот так можно все css и js, если они без .min
  //var patternCssJsOnlyMin = devRelPath + patternFolder + patternFileCssJsOnlyMin;  // только .min.css и .min.js

  var patternDefault = patternCssJs;  // дефолтный паттерн, допустим тут дефолтным будет тот, который любые CSS или JS файлы выбирает
  var patternFinal = patternDefault;  // финальный паттерн, по которому будем искать файлы через Glob

  // тут добавляю учёт консольных флагов при отборе файлов:
  if (options.cli_path) {  // если передан полный путь то он полностью перебивает паттерн который у нас в этом таске
    patternFinal = options.cli_path;
  } else if (options.cli_folder && options.cli_file) {  // если передан отдельно путь к папке и отдельно файл
    patternFinal = options.cli_folder + options.cli_file;
  } else if (options.cli_folder) {  // если передан только путь к папке 
    patternFinal = options.cli_folder + patternFileCssJs;  // тогда путь к файлу берём дефолтный, в данном случае - для css и js
  } else if (options.cli_file) {  // если передан только путь к файлу 
    patternFinal = patternFolder + options.cli_file;  // тогда путь к папке берём дефолтный
  }  // ну вот, вроде бы всё учли... 

  // получаю в переменную массив строк, каждая строка - путь к одному css или js файлу
  var files = glob.sync(patternFinal, {ignore: [patternDjangoAppsFiles, patternExcludedFiles]});  // вторым аргументом передаём массив строк с паттернами игнорируемых файлов
  console.log('Получившаяся выборка файлов:');
  for (var i = 0; i < files.length; i++) {
    console.log(files[i]);
  }

  // записываю в переменную tasks результат выполнения метода .map (новый массив)
  var tasks = files.map(function(file) {  // этот метод Array.map пробегается по массиву files и к каждому элементу file применит функцию, в которой мы находимся:
    // формируем необходимые переменные
    var entryDirName = path.dirname(file);  // получаем строку, содержащую путь к папке конкретного файла (file)
    var entryBaseName = path.basename(file);  // получаем строку, содержащую только название файла
    var entryExtName = path.extname(file);  // получаем строку, содержащую расширение файла (в данном случае будет '.css')

    var endOfEntryPath = entryDirName.slice(devRelPath.length);  // отрезаем от строки с путём к папке вот эту часть: './project/static/dev/'
    // таким образом у нас к примеру для папки './project/static/dev/hotels/css/' получится строка 'hotels/css/'

    // генерим абсолютный путь к этой папке в расположении для разработки (если нам это нужно)
    var devAbsPath = path.resolve(devRelPath, endOfEntryPath);
    // генерим абсолютный путь к папке, в которой файл должен оказаться в продакшене
    var buildAbsPath = path.resolve(buildRelPath, endOfEntryPath);  
    // для того же примера: './project/static/build/' соединим с 'hotels/css/' и получим './project/static/build/hotels/css/'
    // Таким образом мы получили путь куда мы этот file будем перекладывать через gulp.dest()

    // Поскольку в files теперь попадают два разных типа файлов, да ещё могут быть уже минимизированные файлы каждого типа,
    // то для этих случаев нам нужно выполнить разную последовательность задач - для этого будем использовать lazipipe и gulp-filter 
    //

    // Пишем 3 фильтра - для неминифицированного CSS, неминифицированного JS и общий, для минифицированных CSS и JS,
    // второй аргумент фильтра означает, что он запоминает состояние потока до того как был применён,
    // и мы можем в любой момент его восстановить к этому состоянию.
    var nonMinifyedCssFilter = filter(patternFolder + patternFileCssNotMin, {restore: true});  // фильтр для не минифицированных CSS
    var nonMinifyedJsFilter = filter(patternFolder + patternFileJsNotMin, {restore: true});  // фильтр для не минифицированных JS
    var minifyedCssJsFilter = filter(patternFolder + patternFileCssJsOnlyMin, {restore: true});  // фильтр для минифицированных CSS и JS файлов

    // Пишем два независимых канала lazypipe, будем переходить в них из основного канала gulp.pipe(),
    // а по окончании, будем в него снова возвращаться. 
    // ВАЖНО: у lazypipe.pipe() чуть другой синтаксис, в отличии от gulp.pipe() 
    // он принимает первым аргументом функцию для выполнения, а вторым - аргумент этой функции

    // канал для минификации JS файлов
    var minifyJsChannel = lazypipe()
      .pipe(gPrint, function(filepath) { return 'going to minify JS file ' + filepath + ' rename, and copy to build dir.'; }) // принтим месседж
      .pipe(uglify)
      .pipe(rename, {suffix: '.min'})  // добавляем суффикс .min перед .js
      .pipe(chmod, parseInt(options.chmod))  // выставляем права на файлики
      .pipe(gulp.dest, devAbsPath);  // последние два .pipe - по желанию, если хотим сохранять минифицированные копии в дев-расположении

    // канал для минификации CSS файлов
    var minifyCssChannel = lazypipe()
      .pipe(gPrint, function(filepath) { return 'going to minify CSS file ' + filepath + ' rename, and copy to build dir.'; }) // принтим месседж
      .pipe(cssnano)
      .pipe(rename, {suffix: '.min'})  // добавляем суффикс .min перед .css
      .pipe(chmod, parseInt(options.chmod))  // выставляем права на файлики
      .pipe(gulp.dest, devAbsPath);  // последние два .pipe - по желанию, если хотим сохранять минифицированные копии в дев-расположении

    // пока сюда попадают и обычные и минифицированные .css и .js файлы
    return gulp.src(file)  // пользуемся галпом как обычно, только у каждого файла будет свой gulp.dest
      .pipe(gulpIf(options.git_modified_new,  // если из консоли передана переменная для слежения за файлами с Git status = 'modified'
        gitStatus({excludeStatus: 'unchanged'}),  // исключаю неизменные файлы
        gitStatus({excludeStatus: 'untracked'})  // исключаю новые файлы, которым ещё не сделали git add
      ))
      .pipe(gulpIf(options.git_modified,  // если из консоли передана переменная для слежения за файлами с Git status = 'modified' и 'untracked'
        gitStatus({excludeStatus: 'unchanged'})  // исключаю только неизменные файлы, новые и изменённые оставляю
      ))
      .pipe(nonMinifyedCssFilter)  // фильтруем только неминифицированный CSS
      .pipe(minifyCssChannel())  // переходим в канал для минификации CSS
      .pipe(nonMinifyedCssFilter.restore)  // по возвращении сбрасываем фильтр
      .pipe(nonMinifyedJsFilter)  // фильтруем только неминифицированный JS
      .pipe(minifyJsChannel())  // переходим в канал для минификации Js
      .pipe(nonMinifyedJsFilter.restore)  // по возвращении сбрасываем фильтр
      .pipe(minifyedCssJsFilter)  // фильтруем только минифицированные файлы
      .pipe(gulp.dest(buildAbsPath));  // копируем все минифицированные файлы в продакшен
  });

  // объединяю все таски в единый поток(stream), это некая абстракция в node.js,
  // некий такой тип объекта, который метод gulp.task должен возвращать
  return es.merge.apply(null, tasks);  
});


gulp.task('build:clean', function() {  // таск для зачистки папки продакшена
  // переопределяем значения паттернов для продакшена, эти переменные нужны, чтобы не зачищать там каждый раз папки наших джанго аппов
  if (options.excludes) {  // данная команда с ключём --no-excludes[--no-exc] зачистит также и папки приложений
    patternDjangoAppsFolders = buildRelPath + patternDjangoApps;
    patternDjangoAppsFiles = patternDjangoAppsFolders + '**/*';
  }
  // из-за особенности работы del.sync() в отличии от glob.sync() приходится указывать в игнорах не только файлы, но и папки в которых они лежат
  return del.sync(buildRelPath + '**/*', { ignore: [patternDjangoAppsFolders, patternDjangoAppsFiles]} );  // чистим статику продакшена кроме папок джанго-аппов 
});


gulp.task('build:django_apps', function() {  // копируем сторонние джанго-аппы в продакшн
  return gulp.src(patternDjangoAppsFiles)
    .pipe(gulp.dest(buildRelPath));
});


gulp.task('default', ['build:css_js']);  // дефолтный таск, запускается командой:  $ gulp