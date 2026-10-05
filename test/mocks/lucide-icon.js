// Stand-in for every `lucide-react-native/icons/<name>` in component tests.
// The package ships its icons as .mjs, which Jest cannot require; and an icon's
// drawing is not what a component test is about.
module.exports = { __esModule: true, default: () => null }
