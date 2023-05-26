module.exports = function getConfig() {
  return {
    // which one is the max depth the script should have access to
    // this will prevent the script to delete, modify files outside of it's scope
    // if you're running the script from a sub directory of the project, then you can
    // set this to for example "../" relative path. "/" is not a valid value (empty means current path)
    secure_base_path: "../",

    // where are the separate project directories
    // relative to mpm.config.json file
    project_root: "../projects/apps",

    // config that will be used to find/replace stuff in certain files
    // json file with specific format
    project_config_file: "[project_path]/config[env].json",

    // where to copy project config file when generating
    // json file with specific format
    project_config_destination:
      "[destination_root]/src/environments/config.json",

    // where is the destination root
    // relative to mpm.config.json file
    destination_root: ".",

    // where are common files stored
    // relative to mpm.config.json file
    common_root: "../projects/common",

    // a common config file we'll be using with every project
    common_config_file: "[common_root]/common.config.json",

    // file and directory list that will be deleted and then softlinked
    // these files will also be used to create new projects
    // simple file copy / link only, no modifications - mostly per project files
    file_list_simple: [
      // ["[project_path]/", "[destination_root]/"],

      // assets

      {
        src: "[project_path]/src/custom.scss",
        dest: "[destination_root]/src/custom.scss",
        type: "link",
      },
      {
        src: "[project_path]/src/theme/variables.scss",
        dest: "[destination_root]/src/theme/variables.scss",
        type: "link",
      },

      {
        src: "[project_path]/android/app/google-services[env].json",
        dest: "[destination_root]/android/app/google-services.json",
        type: "copy",
      },

      {
        src: "[project_path]/ios/App/App/GoogleService-Info[env].plist",
        dest: "[destination_root]/ios/App/App/GoogleService-Info.plist",
        type: "copy",
      },

      // ... other files

    ],

    // file liest used for cleanup, all files here will be delted during checkout
    file_list_delete: ["[destination_root]/android/app/src/main/java/com"],

    // copy and modify files
    // this is used to copy files that have variables in them
    // these files are usually kept in a common place, and copied to project when
    // changed, also if we change the content of them, we can update them in common forlder or wherever
    // ... mostly files that will be modded for each project, and used from a common place - not per project stuff
    // generated files so to speak, but it can do copy only if there's not replace_rules defined
    file_list_mod: [

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

    // list of commands to execute before checkout proccess
    execute_before: ["echo *execute before placeholder*\n"],

    // list of commands to execute after checkout proccess
    execute_after: ["echo *execute after placeholder*\n"],
    // example : ["build cleanup", "build libs", "build compile"],
  };
};
