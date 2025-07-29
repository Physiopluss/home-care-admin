module.exports = {
    apps: [
      {
        name: "app",
        script: "app.js",
        interpreter: "node",
        cwd: "/path/to/your/project",
        args: "",
        autorestart: true,
        watch: false,
        max_memory_restart: "1G",
        env: {
          NODE_ENV: "production",
           
        },
      },
    ],
  };
  