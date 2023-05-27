module.exports = function getConfig() {
  return {
    // The maximum path depth that a script can access.
    // This prevents the script from deleting or modifying files outside its scope.
    // If you run the script from a subdirectory of the project, set this to the relative path, e.g.,
    // "../" relative path. "/" is not a valid value (empty means the current path).
    secure_base_path: "../",

    // The separate project directories, relative to mpm.config.json file.
    project_root: "../projects/apps",

    // Config file used to find/replace content in certain files; must be a JSON file with a specific format.
    project_config_file: "[project_path]/config[env].json",

    // Destination for copying the project configuration file during generation; must be a JSON file with a specific format.
    project_config_destination: "[destination_root]/src/environments/config.json",

    // The destination root folder relative to mpm.config.json file.
    destination_root: ".",

    // The common files storage folder relative to mpm.config.json file. 
    common_root: "../projects/common",

    // The common config file used for every project.
    common_config_file: "[common_root]/common.config.json",

    // List of files and directories that will be deleted and then soft-linked.
    // These files will also be used to create new projects.
    // This is a simple file copy/link only, no modifications are done - mostly per project files.
    file_list_simple: [
      // Assets - example
      
      // Link source and destination for custom.scss
      {
        src: "[project_path]/src/custom.scss",
        dest: "[destination_root]/src/custom.scss",
        type: "link",
      },

      // Link source and destination for variables.scss
      {
        src: "[project_path]/src/theme/variables.scss",
        dest: "[destination_root]/src/theme/variables.scss",
        type: "link",
      },

      // Copy source and destination for google-services[env].json
      {
        src: "[project_path]/android/app/google-services[env].json",
        dest: "[destination_root]/android/app/google-services.json",
        type: "copy",
      },

      // Copy source and destination for GoogleService-Info[env].plist
      {
        src: "[project_path]/ios/App/App/GoogleService-Info[env].plist",
        dest: "[destination_root]/ios/App/App/GoogleService-Info.plist",
        type: "copy",
      },
      
      // ... Other files

    ],

    // List of files used for cleanup. All files in this list will be deleted during checkout.
    file_list_delete: ["[destination_root]/android/app/src/main/java/com"],

    // List of files that will be copied and modified.
    // This list is used to copy files containing variables.
    // These files are kept in a common place and copied to the project when changed.
    // Files may also be updated in the common folder or elsewhere.
    // Mostly these are files that are modified for each project and used from a common place – not per project files.
    // If there are no replace_rules defined, these files will act as generated files.
    file_list_mod: [

      // example
      
      {
        src: "[common_root]/android/app/src/main/AndroidManifest.xml",
        dest: "[destination_root]/android/app/src/main/AndroidManifest.xml",

        replace_rules: (config) => {
          return [
            {
              find: /(<manifest.*package=")[^"]*"/ms,
              replace_variable: "$1" + config["APP_STORE_ID"] + '"',
              replace_placeholder: "$1[app_store_id]" + '"',
            },
            {
              find: /(<activity[^<]*android:name=")[^"]*"/ms,
              replace_variable:
                "$1" + config["APP_STORE_ID"] + '.MainActivity"',
              replace_placeholder: '$1[app_activity_id]"',
            },

          ];
        },
      },

      {
        src: "[common_root]/ios/App/App/App.entitlements",
        dest: "[destination_root]/ios/App/App/App.entitlements",

        replace_rules: (config) => {
          return [
            {
              find: /(com\.apple\.developer\.associated-domains<\/key>[^<]*<array>)(.*)(<\/array>)/gms,
              replace_variable:
                "$1" +
                `
              <string>applinks:${config["URI_SCHEME"]}.onelink.me</string>
              <string>applinks:${config["DEEPLINK_HOST"]}</string>
              <string>applinks:*.${config["DEEPLINK_HOST"]}</string>
              <string>webcredentials:${config["DEEPLINK_HOST"]}</string>
              ` +
                "$3",
              replace_placeholder: "$1[deeplink_config]$3",
            },
          ];
        },
      },

    ],

    // List of commands to execute before the checkout process.
    execute_before: ["echo *execute before placeholder*\n"],

    // List of commands to execute after the checkout process.
    execute_after: ["echo *execute after placeholder*\n"],
  };
};