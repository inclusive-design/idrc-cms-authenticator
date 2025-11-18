import { defineConfig } from "vitest/config";

export default defineConfig({
	coverage: {
		reporter: [["clover", { file: "coverage/clover.xml" }], ["text"]],
	},
});
