module.exports = {
  expo: {
    name: "오늘야구각",
    slug: "dugoutpick",
    owner: "singsingmin",
    version: "1.0.0",
    scheme: "dugoutpick",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#F3E9CE"
    },
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.singsingmin.dugoutpick",
      adaptiveIcon: {
        backgroundColor: "#34663F",
        foregroundImage: "./assets/adaptive-icon.png"
      },
      predictiveBackGestureEnabled: false
    },
    web: {
      bundler: "metro",
      output: "single",
      baseUrl: "/dugoutpick",
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-font",
      "expo-notifications",
      "expo-web-browser"
    ],
    extra: {
      eas: {
        projectId: "2dca77a5-dcf4-4759-863d-91e1cf81dcc7"
      },
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || null,
      supabaseUrl: process.env.SUPABASE_URL || null,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    }
  }
};
