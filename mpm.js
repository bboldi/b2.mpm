#!/usr/bin/env node

const yargs = require("yargs");
const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");
const jsdiff = require("diff");
const spawn = require("child_process").spawn;

// init project?
if(process.argv[2] == "init") {
  // init project
  initProject(); 
  process.exit(0);
}

let getConfig = require(path.join(process.cwd(),"mpm.config.js"));

// variable to keep config overwrite stuff
let overwrite_config = {};

// env string can be passed as --env and will be replaced everywhere in config
// can be used for example to handle per environment files, options
let env = "";

// change root
changeRoot();

// @note we can keep some stuff in a hidden local file like .mpmcache.json - for example current active project

// get not specific config

var mpmConfig = getConfig();

/**
 * return config object - and overwrite stuff based on cli params
 * @returns
 */
function conf() {
  let _conf = { ...mpmConfig, ...overwrite_config };
  return _conf;
}

/**
 * set overwrite data
 * @param {*} data
 */
function setOverwriteData(data) {
  if (data) {
    overwrite_config = getObjectFromArrayPairs(data);
  }
}

function _spawnEvent(code, resolve, reject, _buffer, command, event) {
  showMessage(`done executing command with ${event} - "${command}" ...`);

  if (code !== 0) {
    showMessage("exec error", code, "error");
    reject(code);
  } else {
    showMessage("exec ok");
    resolve(_buffer);
  }
}

/**
 * Async run commands
 * @param {*} command
 * @returns
 */
async function runcmd(command) {
  let _buffer = "";
  showMessage(`start executing command "${command}" ...`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
    });

    child.on("exit", (code) =>
      _spawnEvent(code, resolve, reject, _buffer, command, "exit")
    );
    child.on("error", (code) =>
      _spawnEvent(code, resolve, reject, _buffer, command, "error")
    );
    //child.on("close", code => _spawnEvent(code, resolve, reject, _buffer, command, "close"))
  });
}

/**
 * Fix path to different OSs
 * @param {string} pathToFix
 */
function fixPathSeparator(pathToFix) {
  let regex = /\//g;
  return pathToFix.replace(regex, path.sep);
}

/*
 * Replace vars - standard replacement
 *
 * special strings can be used in values:
 * - [project_root] - root, where the projects are located
 * - [project_path] - path of a specific project [project_foot]/[project_name]
 * - [common_root] - root where we keep the common fines - non project related
 * - [destination_root] - the target root, where we want the project files to be copied
 * - [_config:KEY] - use value from config under KEY ( does not work on some places - where we do not have project config)
 */
function replaceSpecialStrings(string, project_name = null, config = {}) {
  // if project name is added, use it to replace stuff

  if (project_name) {
    string = string.replace("[project_path]", getProjectPath(project_name));
  }

  // replace env everywhere
  string = string.replace("[env]", env);

  string = string.replace(
    "[project_root]",
    getAbsolutePath(conf().project_root)
  );
  string = string.replace("[common_root]", getAbsolutePath(conf().common_root));
  string = string.replace(
    "[destination_root]",
    getAbsolutePath(conf().destination_root)
  );

  // config related if we have any

  if (!_.isEmpty(config)) {
    // replace specially formatted stuff
    do {
      _wasMatch = false;

      let rgx = /(\[_config:)([^\]]*)\]/gms;
      let result = rgx.exec(string);

      if (result && result[2]) {
        _wasMatch = true;

        if (!config[result[2]]) {
          throwError(`Config value not found [_config:${result[2]}] !`, true);
        }
        string = string.replace(result[0], config[result[2]]);
        showMessage(
          `Replacing [_config:${result[2]}] -> ${config[result[2]]} ... `
        );
      }
    } while (_wasMatch);
  }

  return string;
}

/**
 * Proccess path, make it secure, replace separator, special strings etc
 * @param {*} pathString
 * @param {*} project_name
 * @returns
 */
function preprocessPath(pathString, project_name = null, config = {}) {
  // replace stuff
  pathString = replaceSpecialStrings(pathString, project_name, config);

  // fix file separator
  pathString = fixPathSeparator(pathString);

  // check if directory is outside of main folder

  let target_path = path.resolve(pathString);
  let base_secure_path = path.resolve(conf().secure_base_path);

  if (base_secure_path.length <= 1) {
    throwError(`secure_base_path cannot be root path!`, true);
  }

  if (target_path.indexOf(base_secure_path) !== 0) {
    throwError(
      `Path "${target_path}" is outside of the scope of secure path "${base_secure_path}"`,
      true
    );
  }

  return pathString;
}

let env_option = {
  alias: "env",
  demandOption: false,
  type: "string",
  describe:
    "env modifier string, will be replaced everywhere in config values, can be used for example to have different files per environment",
};

let overwrite_option = {
  alias: "overwrite_config",
  demandOption: false,
  type: "array",
  describe: `overwrite_config ( -o ) array of values to overwrite in
              the config value - allows running command with different 
              params than default in mpm.config.js

              format:

              -o key1 value1 key2 value2

              of

              -o key1 value1 -o key2 value2

              key and value has to be in pairs
              
              example:

              -o key1 value1 -o key2 "another complex value"`,
};

// implementation

var argv = yargs
  .usage("Usage: $0 <command> [options]")

  .command({
    command: "new [name]",
    desc: "Create new project based on mpm.config.js file, and current project",
    builder: (yargs) => {
      return yargs
        .positional("name", {
          describe: "project name - valid format: [a-zA-Z0-9-_]+ ",
        })
        .check((argv) => {
          let _rx = /^[a-zA-Z0-9-_]+$/gm;
          if (_rx.test(argv.name)) {
            return true;
          }
          throw new Error("Incorrect format: name has to match [a-zA-Z0-9-_]+");
        })
        .demandOption("name");
    },
    handler: async (argv) => {
      await createNewProject(argv.name, conf());
    },
  })

  .command({
    command: "update [name]",
    desc: "Update common files based on current project",
    builder: (yargs) => {
      return yargs
        .positional("name", {
          describe: "project name - valid format: [a-zA-Z0-9-_]+ ",
        })
        .check((argv) => {
          let _rx = /^[a-zA-Z0-9-_]+$/gm;
          if (_rx.test(argv.name)) {
            return true;
          }
          throw new Error("Incorrect format: name has to match [a-zA-Z0-9-_]+");
        })
        .demandOption("name");
    },
    handler: async (argv) => {
      await updateCopyModFiles(argv.name, conf());
    },
  })

  .command({
    command: "gitignore",
    desc: "Get gitignore entry list based on current config",
    handler: async () => {
      await getGitignore();
    },
  })

  .command({
    command: "diff [name]",
    desc: "Generate difference for copy/mod files",
    builder: (yargs) => {
      return yargs
        .positional("name", {
          describe: "project name - valid format: [a-zA-Z0-9-_]+ ",
        })
        .check((argv) => {
          let _rx = /^[a-zA-Z0-9-_]+$/gm;
          if (_rx.test(argv.name)) {
            return true;
          }
          throw new Error("Incorrect format: name has to match [a-zA-Z0-9-_]+");
        })
        .demandOption("name");
    },
    handler: async (argv) => {
      await showDiff(argv.name, conf());
    },
  })
  .command({
    command: "qcheckout [name]",
    desc: "Check out project QUICK ( force overwrite, skip build )",
    builder: (yargs) => {
      return yargs
        .positional("name", {
          describe: "project name - valid format: [a-zA-Z0-9-_]+ ",
        })
        .check((argv) => {
          let _rx = /^[a-zA-Z0-9-_]+$/gm;
          if (_rx.test(argv.name)) {
            return true;
          }
          throw new Error("Incorrect format: name has to match [a-zA-Z0-9-_]+");
        })
        .options({
          o: overwrite_option,
          e: env_option,
          n: {
            alias: "name",
            demandOption: true,
            type: "string",
            describe: "name of the project",
          },
        })
        .demandOption("name");
    },
    handler: async (argv) => {
      // set overwrite data
      setOverwriteData(argv["o"]);

      // set mod data
      if (argv["e"]) {
        env = argv["e"];
      }

      await checkoutProject(argv.name, conf(), true, true, !!argv["c"]);
    },
  })

  .command({
    command: "checkout [name]",
    desc: "Check out project",
    builder: (yargs) => {
      return yargs
        .options({
          f: {
            alias: "force",
            demandOption: false,
            type: "boolean",
            describe:
              "force ( -f ) - add this flag to force overwrite files even if they differ",
          },
          c: {
            alias: "copyonly",
            demandOption: false,
            type: "boolean",
            describe: "force copy only, don't link files when checking out",
          },
          s: {
            alias: "skip_commands",
            demandOption: false,
            type: "boolean",
            describe:
              "skip_commands ( -s ) - do not execute anything when checking project out",
          },
          o: overwrite_option,
          n: {
            alias: "name",
            demandOption: true,
            type: "string",
            describe: "name of the project",
          },
          e: env_option,
        })
        .positional("name", {
          describe: "project name - valid format: [a-zA-Z0-9-_]+ ",
        })
        .check((argv) => {
          let _rx = /^[a-zA-Z0-9-_]+$/gm;
          if (_rx.test(argv.name)) {
            return true;
          }
          throw new Error("Incorrect format: name has to match [a-zA-Z0-9-_]+");
        })
        .demandOption("name");
    },
    handler: async (argv) => {
      // set overwrite data
      setOverwriteData(argv["o"]);

      // set env data
      if (argv["e"]) {
        env = argv["e"];
      }

      await checkoutProject(
        argv.name,
        conf(),
        !!argv["f"],
        !!argv["s"],
        !!argv["c"]
      );
    },
  })
  .command({
    command: "*",
    handler() {
      yargs.showHelp();
    },
  })
  .showHelpOnFail(true).argv;

function getObjectFromArrayPairs(data) {
  if (!_.isArray(data)) {
    return {};
  }

  let _res = {};

  // fetch key value pairs

  for (let i = 0; i < data.length; i += 2) {
    if (data.length > i + 1) _res[data[i]] = data[i + 1];
  }

  return _res;
}

/**
 * Get gitignore list
 * @param {*} mpmConfig
 */
async function getGitignore() {
  showMessage(`Generating .gitignore entities ... `);

  let flist = [];

  // add linked files

  conf().file_list_simple.forEach((e) => {
    flist.push(preprocessPath(e.dest));
  });

  // add mod files

  conf().file_list_mod.forEach((e) => {
    flist.push(preprocessPath(e.dest));
  });

  if (flist.length > 0) {
    console.log("\n----------- ADD THIS STUFF TO .gitignore ----------\n");
    console.log("# mpm .gitignore entries ...\n");
    flist.forEach((e) => {
      // remove dot from start of the string
      console.log(e.replace(/^\.\//gm, "/"));
    });
    console.log("\n# ... end of mpm .gitignore entries");
    console.log("\n-----------             END              ----------\n");
  }
}
/**
 * Get current root
 * @returns
 */
function getRoot() {
  return process.cwd();
  // @note DEBUG ONLY
  //return "/home/bboldi/projects/hellosingles-app/app";
}

/**
 * Get project path
 * @param {*} project_name
 * @returns
 */
function getProjectPath(project_name) {
  return path.join(getRoot(), conf().project_root, project_name);
}

/**
 * Return absolute path based on relative path
 * @param {*} path
 * @returns
 */
function getAbsolutePath(pathString) {
  return path.join(getRoot(), pathString);
}

/**
 * Change root in script globally
 */
function changeRoot() {
  showMessage(`chdir to ${getRoot()}`);
  process.chdir(getRoot());
}

/**
 * Check if project exists
 *
 * @param {*} project_name
 * @returns
 */
function doProjectExists(project_name) {
  let project_path = getProjectPath(project_name);
  return fs.existsSync(project_path);
}

/*
 * Message dispaly helper
 * @param {*} message
 * @param {*} data
 */
function showMessage(message, data = null, mtype = "log") {
  let color =
    mtype == "error"
      ? "\x1b[1;31m"
      : mtype == "warning"
      ? "\x1b[1;33m"
      : "\x1b[1;32m";

  if (data) {
    console.log(`${color}░▒▓ \x1b[0m${message}`, data);
  } else {
    console.log(`${color}░▒▓ \x1b[0m${message}`);
  }
}

/**
 * Error display helper
 * @param {*} message
 * @param {*} isBreaking
 */
function throwError(message, isBreaking = true) {
  if (isBreaking) {
    throw new Error(message);
  }

  showMessage(message, null, "error");
}

/**
 * Check out project ( copy files from template to real directory)
 * @param {*} project_name
 * @param {*} config
 */
async function checkoutProject(
  project_name,
  config,
  doForce,
  doSkipBuild,
  copyOnly = false
) {
  showMessage(`Checking out project "${project_name}" ...`);
  if (doForce) {
    showMessage(`Force overwrite files ( -f flag ) ...`, null, "warning");
  }
  if (doSkipBuild) {
    showMessage(`Skipping command execution ( -s flag ) ...`, null, "warning");
  }

  if (!doProjectExists(project_name)) {
    throwError(`Project "${project_name}" does not exists!`, true);
  }

  // before starting check if there's a diff

  _diff = await diffProject(project_name, config);

  if (!isDiffEmpty(_diff) && !doForce) {
    showMessage(
      `There is some diff in the current files, looks liek you've edited them - if you're sure and want to overwrite them, please add the 'force' flag to the command!`,
      null,
      "warning"
    );
    displayDiff(_diff);
    process.exit();
  }

  // get project conf

  let pconf = await getProjectConfigFile(project_name);

  // execute before

  if (conf().execute_before.length > 0 && !doSkipBuild) {
    showMessage(`Executing commands from execute_before param ...`);

    //await conf().execute_before.forEach(async (cmd) => {
    for (let cmd of conf().execute_before) {
      // replace special stuff
      cmd = replaceSpecialStrings(cmd, project_name, pconf);
      await runcmd(cmd);
    }
  } else {
    showMessage(`Skipping execution_before ... `, null, "warning");
  }

  // delete/cleanup

  await config.file_list_delete.forEach(async (df) => {
    showMessage(`Deleting file ${df} ...`);
    await fs.remove(preprocessPath(df, project_name, pconf));
  });

  // linked/copy files

  showMessage(`Processing linked/copied files ... `);

  for (i = 0; i < config.file_list_simple.length; i++) {
    let obj = config.file_list_simple[i];
    let source = preprocessPath(obj.src, project_name, pconf);
    let destination = preprocessPath(obj.dest, project_name, pconf);

    if (!fs.existsSync(source)) {
      throwError(`File does not exists: ${source}`);
    }

    try {
      // delete softlinked files
      showMessage(`Deleting destination file : ${destination} ...`);
      await fs.remove(destination);

      // softlink existing files
      await ensureDirForFile(destination);

      if (obj.type == "copy" || copyOnly) {
        showMessage(`Copying : ${source} -> ${destination} ...`);
        // copy file if defined
        await fs.copy(source, destination, {
          overwrite: true, // overwrite if exists
          recursive: true, // copy folders - all stuff
          dereference: true, // copy files, not simlinks
        });
      } else {
        showMessage(`Linking : ${source} -> ${destination} ...`);
        // default will create link only
        await linkFile(source, destination);
      }
    } catch (error) {
      throwError(error.message, true);
    }
  }

  showMessage(`Processing copy/mod files ... `);

  for (i = 0; i < config.file_list_mod.length; i++) {
    let obj = config.file_list_mod[i];

    let source = preprocessPath(obj.src, project_name, pconf);
    let destination = preprocessPath(obj.dest, project_name, pconf);

    try {
      // delete copied files
      showMessage(`Deleting destination (mod) file : ${destination} ...`);
      await fs.remove(destination);

      // process file copy/replace
      await processModFile(
        obj,
        "replace_variable",
        source,
        destination,
        project_name
      );
    } catch (error) {
      throwError(error.message, true);
    }
  }

  // link config file

  let config_src = preprocessPath(
    config.project_config_file,
    project_name,
    pconf
  );
  let config_dest = preprocessPath(
    config.project_config_destination,
    project_name,
    pconf
  );

  showMessage(`Deleting destination config file "${config_dest} ... `);
  await fs.remove(config_dest);

  if (copyOnly) {
    showMessage(`Copying config file "${config_src}" -> "${config_dest} ... `);
    await fs.copy(config_src, config_dest, {
      overwrite: true, // overwrite if exists
      recursive: true, // copy folders - all stuff
      dereference: true, // copy files, not simlinks
    });
  } else {
    showMessage(`Linking config file "${config_src}" -> "${config_dest} ... `);
    await linkFile(config_src, config_dest);
  }

  // execute after

  if (conf().execute_after.length > 0 && !doSkipBuild) {
    showMessage(`Executing commands from execute_after param ...`);

    for (let cmd of conf().execute_after) {
      // replace special stuff
      cmd = replaceSpecialStrings(cmd, project_name, pconf);
      await runcmd(cmd);
    }
  } else {
    showMessage(`Skipping execution_after ... `, null, "warning");
  }

  showMessage(`DONE!`);
}

/**
 * Get project related JSON file to use as values
 */
async function getProjectConfigFile(project_name) {
  try {
    // get common config if there is any

    let ccfg = {};

    if (conf().common_config_file) {
      try {
        ccfg = await fs.readFile(
          preprocessPath(conf().common_config_file, project_name),
          "utf8"
        );
      } catch (error) {
        showMessage(
          `Cannot open common.config.json, skipping`,
          conf().common_root + "/common.config.json"
        );
      }
    }

    // get project config

    let cfg = await fs.readFile(
      preprocessPath(conf().project_config_file, project_name),
      "utf8"
    );

    // return data

    let cfgo = JSON.parse(cfg);
    let ccfgo = JSON.parse(ccfg);
    return { ...cfgo, ...ccfgo };
  } catch (error) {
    throwError(error.message, true);
  }
}

/**
 * Helper function to ensure that the dir exists for a specific file
 * @param {*} destination
 */
async function ensureDirForFile(destination) {
  if (!fs.existsSync(path.dirname(destination))) {
    showMessage(`Creating directory "${path.dirname(destination)} ... `);
    return await fs.ensureDir(path.dirname(destination));
  }

  return Promise.resolve();
}

/**
 * Helper function to process mod files, replace vars, copy them, etc
 * @param {*} obj
 * @param {*} replace_key
 * @param {*} source
 * @param {*} destination
 * @param {*} project_name
 */
async function processModFile(
  obj,
  replace_key,
  source,
  destination,
  project_name
) {
  // copy/replace files
  if (
    obj.replace_rules &&
    obj.replace_rules({}) &&
    obj.replace_rules({}).length > 0
  ) {
    // get all , not only app related
    let pconf = await getProjectConfigFile(project_name);

    source = preprocessPath(source, project_name, pconf);
    destination = preprocessPath(destination, project_name, pconf);

    showMessage(`Using source file "${source}" ...`);

    // cehck if we're working with a file
    if (!fs.lstatSync(source).isFile()) {
      throwError(`"${source}" is not a file!`, true);
    }

    try {
      showMessage(`Replacing content variables ...`);

      // read file content
      let fileContent = await fs.readFile(source, "utf8");

      // replace stuff

      obj.replace_rules(pconf).forEach((e) => {
        fileContent = fileContent.replace(e.find, e[replace_key]);
      });

      // make directory if does not exists

      if (!fs.existsSync(path.dirname(destination))) {
        showMessage(`Creating directory "${path.dirname(destination)} ... `);
        await fs.ensureDir(path.dirname(destination));
      }

      // write file

      await fs.writeFile(destination, fileContent, {
        encoding: "utf8",
        flag: "w+",
      });

      showMessage(`Writing ${destination}`);
    } catch (error) {
      throwError(error.message, true);
    }
  } else {
    showMessage(`Copying : ${source} -> ${destination} ...`);
    // copy file

    await fs.copy(source, destination, {
      overwrite: true, // overwrite if exists
      recursive: true, // copy folders - all stuff
      dereference: true, // copy files, not simlinks
    });
  }
}

/**
 * Update variable files based on project
 * @param {*} project_name
 * @param {*} config
 */
async function updateCopyModFiles(project_name, config) {
  showMessage(
    `Updating config mod files based on current values "${project_name}" ...`
  );

  let pconf = getProjectConfigFile(project_name);

  if (!doProjectExists(project_name)) {
    throwError(`Project "${project_name}" does not exists!`, true);
  }

  for (i = 0; i < config.file_list_mod.length; i++) {
    let obj = config.file_list_mod[i];

    let source = preprocessPath(obj.dest, project_name, pconf);
    let destination = preprocessPath(obj.src, project_name, pconf);

    // process file copy/replace
    await processModFile(
      obj,
      "replace_placeholder",
      source,
      destination,
      project_name
    );
  }

  showMessage(`DONE!`);
}

/**
 * Helper function to link files properly on different os'
 * @param {*} sourceFile
 * @param {*} destFile
 */
async function linkFile(sourceFile, destFile) {
  try {
    if (process.platform !== "win32") {
      await fs.symlink(sourceFile, destFile);
    } else {
      if (fs.lstatSync(sourceFile).isDirectory()) {
        await fs.symlink(sourceFile, destFile, "junction");
      } else {
        await fs.link(sourceFile, destFile);
      }
    }
  } catch (error) {
    throwError(error.message, true);
  }
}

/*
 * Check project diff
 * @param {*} project_name
 * @param {*} config
 */
async function diffProject(project_name, config) {
  _diffResult = {};

  for (i = 0; i < config.file_list_mod.length; i++) {
    let obj = config.file_list_mod[i];

    let key = obj.src.split("/").pop() || "";

    let source = preprocessPath(obj.src, project_name);
    let destination = preprocessPath(obj.dest, project_name);

    if (!fs.existsSync(source) || !fs.existsSync(destination)) {
      showMessage(
        `WARNING: "${source}" Diff failed file not found - skipping ...`
      );
      continue;
    }

    let srcContent = await fs.readFile(source, "utf8");
    let destContent = await fs.readFile(destination, "utf8");

    showMessage(`Checking diff for "${source}" ...`);

    // if we have to replace stuff, then we do that
    if (
      obj.replace_rules &&
      obj.replace_rules(config) &&
      obj.replace_rules(config).length > 0
    ) {
      // equalize file formats
      obj.replace_rules(config).forEach((e) => {
        srcContent = srcContent.replace(e.find, e.replace_placeholder);
        destContent = destContent.replace(e.find, e.replace_placeholder);
      });
    }

    // diff files

    let diff = jsdiff.diffLines(srcContent, destContent, {
      ignoreWhitespace: true,
    });

    _diffResult[key] = [];

    _currentLine = 1;

    // go through the diffs
    diff.forEach(function (part) {
      // green for additions, red for deletions
      // grey for common parts

      let color = part.added
        ? "\x1b[32m"
        : part.removed
        ? "\x1b[31m"
        : "\x1b[0m";

      if (part.added || part.removed) {
        let _prefixChar = part.added ? "added" : "removed";
        // something have changed other than template stuff, output
        _diffResult[key].push(
          `${color}${_prefixChar} at line ${_currentLine} :\n-----------\n${part.value}-----------\x1b[0m`
        );
      }

      _currentLine += part.count;
    });
  }

  return _diffResult;
}

/**
 * Helper function to tell if diff is empty
 * @param {*} _diffResult
 * @returns
 */
function isDiffEmpty(_diffResult) {
  _wasDiff = false;
  Object.keys(_diffResult).forEach((e) => {
    if (!_.isEmpty(_diffResult[e])) {
      _wasDiff = true;
    }
  });
  return !_wasDiff;
}

/**
 * Display diff result
 *
 * @param {*} project_name
 * @param {*} config
 */
async function showDiff(project_name, config) {
  _result = await diffProject(project_name, config);
  displayDiff(_result);
}

/**
 * Display diff object
 * @param {*} _diffResult
 */
function displayDiff(_diffResult) {
  _wasDiff = false;

  Object.keys(_diffResult).forEach((e) => {
    if (!_.isEmpty(_diffResult[e])) {
      _wasDiff = true;
      showMessage(`Diff for file "${e}":`);

      _diffResult[e].forEach((a) => {
        console.log(a);
      });
    }
  });

  if (!_wasDiff) {
    showMessage(`All files are identical!`);
  }
}

/**
 * Helper function to tell if main config file exists
 * @returns boolean
 */
function mainConfigExists()
{
  var _dest = path.join(process.cwd(),"mpm.config.js"); 
  return fs.existsSync(_dest);
}

/**
 * Initialize project config file
 */
function initProject() {
  var _dest = path.join(process.cwd(),"mpm.config.js"); 

  if (!fs.existsSync(_dest)) {
    fs.copySync(path.join(__dirname,"example.mpm.config.js"), _dest, { overwrite: false });
    showMessage(`Project config file created at "${_dest}"! Please edit it to your needs!`);
  } else {
    showMessage(`WARNINIG: ${_dest} already exists!`);
  }
}

/**
 * Create new project based on config files
 *
 * @param {*} project_name
 */
async function createNewProject(project_name, config) {
  showMessage(`Creating new project "${project_name}" ...`);

  // copy linked file list from real path to the project path ( will this work with links? )
  // copy files from real location to config location and replace special stuff with tags

  // gather file list to copy

  if (doProjectExists(project_name)) {
    throwError(`Project "${project_name}" already exists!`, true);
  }

  let project_destination_root = getProjectPath(project_name);

  // create project folder
  fs.mkdirpSync(project_destination_root);

  // copy linked files
  for (let i = 0; i < config.file_list_simple.length; i++) {
    let destination = preprocessPath(
      config.file_list_simple[i].src,
      project_name
    );
    let source = preprocessPath(config.file_list_simple[i].dest, project_name);

    try {
      showMessage(`Copying : ${source} -> ${destination}`);

      await fs.copy(source, destination, {
        overwrite: true, // overwrite if exists
        recursive: true, // copy folders - all stuff
        dereference: true, // copy files, not simlinks
      });
    } catch (error) {
      throwError(error.message, true);
    }
  }

  // copy config

  let config_src = preprocessPath(
    config.project_config_destination,
    project_name
  );
  let config_dest = preprocessPath(config.project_config_file, project_name);

  showMessage(`Copy config file "${config_src}" -> "${config_dest} ... `);

  if (fs.existsSync(config_src)) {
    await fs.copy(config_src, config_dest, {
      overwrite: true, // overwrite if exists
      recursive: true, // copy folders - all stuff
      dereference: true, // copy files, not simlinks
    });
  } else {
    // ERROR
    showMessage(`WARNINIG: ${config_src} DOES NOT EXISTS! Not copied!`);
  }

  showMessage("DONE!");
}
