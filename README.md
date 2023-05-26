# b2.mpm (Multiple Project Manager)

A Node utility to help you manage multiple projects on the same codebase. This is particularly useful for projects where you need to compile the same codebase with different themes or configs, such as Ionic or web projects, and where that's not supported out of the box.

MPM allows you to easily switch, update, diff and create new projects based on a single configuration file (`mpm.config.js`).

## Installation

You can install MPM with the following command:

```
npm install -g b2.mpm
```

## Usage

MPM is a command-line tool that provides the following commands:

```
mpm new <name>               - Create new project based on mpm.config.js file, and current project
mpm update <name>            - Update common files based on current project
mpm gitignore                - Get gitignore entry list based on current config
mpm diff <name>              - Generate difference for copy/mod files
mpm qcheckout <name> [options] - Check out project QUICK (force overwrite, skip build)
mpm checkout <name> [options]  - Check out project
```

To use MPM, you need to create an `mpm.config.js` file in your project's root folder, which MPM will use as the base configuration for all project-related tasks.

Below is an example `mpm.config.js` file with comments explaining each of the settings:

```javascript
module.exports = function getConfig() {
  return {
    // Set the max depth the script should have access to.
    // This will prevent the script from modifying files outside its scope.
    secure_base_path: "../",

    // Path to separate project directories, relative to mpm.config.json file.
    project_root: "../projects/apps",

    // Config that will be used to find/replace stuff in certain files.
    project_config_file: "[project_path]/config[env].json",

    // Where to copy the project config file when generating.
    project_config_destination:
      "[destination_root]/src/environments/config.json",

    // Destination root, relative to mpm.config.json file.
    destination_root: ".",

    // Where common files are stored, relative to mpm.config.json file.
    common_root: "../projects/common",

    // Common config file used with every project.
    common_config_file: "[common_root]/common.config.json",

    // File and directory list to be deleted and then softlinked.
    file_list_simple: [
      {
        src: "[project_path]/src/custom.scss",
        dest: "[destination_root]/src/custom.scss",
        type: "link",
      },
      // ...other files
    ],

    // File list used for cleanup. All files here will be deleted during checkout.
    file_list_delete: ["[destination_root]/android/app/src/main/java/com"],

    // Copy and modify files.
    file_list_mod: [
      {
        src: "[common_root]/android/app/src/main/AndroidManifest.xml",
        dest: "[destination_root]/android/app/src/main/AndroidManifest.xml",

        replace_rules: (config) => {
          return [
            {
              // Add your specific custom rules here.
            },
          ];
        },
      },
      // ...other files
    ],

    // List of commands to execute before the checkout process.
    execute_before: ["echo *execute before placeholder*\n"],

    // List of commands to execute after the checkout process.
    execute_after: ["echo *execute after placeholder*\n"],
  };
};
```

After setting up your `mpm.config.js` file, you can start using MPM to manage your projects.

For help and command options, run:

```
mpm --help
```

Commands can accept options. For example, when using `mpm checkout <name>`, you can use the following options:

```
-f, --force       Force overwrite files even if they differ
-c, --copyonly    Force copy only, don't link files when checking out
-s, --skip_commands   Do not execute anything when checking project out
-o, --overwrite   Change replacement rules
-n, --name        Name of the project
-e, --env         Environment name (for example: dev, prod)
```

Example:

```
mpm checkout projectName -f --env=dev
```

This command will check out the project named `projectName`, force file overwriting even if they differ, and use the `dev` environment configuration.

### Project directory structure example

Here's a sample directory structure and file layout for a project using MPM:

```
project-root/
├── mpm.config.js
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   └── ...
│   │   ├── services/
│   │   │   └── ...
│   │   └── app.component.ts
│   ├── theme/
│   └── main.ts
├── projects/
│   ├── apps/
│   │   ├── project1/
│   │   │   ├── config.json
│   │   │   ├── src/
│   │   │   │   ├── custom.scss
│   │   │   │   └── theme/
│   │   │   │       └── variables.scss
│   │   │   └── assets/
│   │   ├── project2/
│   │   │   └── ...
│   ├── common/
│   │   ├── common.config.json
│   │   ├── android/
│   │   │   └── app/
│   │   │       └── src/
│   │   │           └── main/
│   │   │               └── AndroidManifest.xml
│   │   ├── ios/
│   │   │   └── App/
│   │   │       └── App/
│   │   │           └── App.entitlements
│   └── ...
└── ionic.config.json (or any other framework-specific config)
```

This sample structure demonstrates the following key elements:

- `project-root`: The main folder containing your codebase and `mpm.config.js`.
- `mpm.config.js`: The configuration file for MPM.
- `src`: The source code folder of the main project.
- `projects`: The folder containing the various project directories and common files.
- `apps`: Project-specific subdirectories, such as `project1` and `project2`.
- `common`: A folder containing common files and assets to be shared among different projects.

Your specific project structure may vary based on your needs and the frameworks you are using, but the sample above should help you get started with organizing your multiple projects using MPM.

## ⚠️ Warning: Use at Your Own Risk

This utility is provided as-is, with no guarantees or warranties of any kind. By using this utility, you acknowledge that you are solely responsible for its proper use, and any consequences that may arise from its usage are your responsibility.

Please ensure you understand the functionality and implications of this utility before deploying it in your projects. It is always a good practice to backup your existing projects, configurations, and codebases before using any new utilities or tools.

Use this utility at your own risk, and exercise caution when applying it to your projects. The developers and maintainers of this utility are not liable for any loss or damage resulting from its usage.