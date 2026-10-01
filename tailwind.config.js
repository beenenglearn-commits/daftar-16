/** @type {import('tailwindcss').Config} */
export default {
  // البنية المسطّحة: ملفات الكود في الجذر (وإن وُجد src يُفحص أيضًا)
  content: ["./index.html", "./*.{js,jsx}", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
