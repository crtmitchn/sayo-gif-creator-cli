import { createPromptModule } from "inquirer";
import { Prompt } from "./types";
import { join } from "path";
import { readdirSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import Logger from "@ptkdev/logger";

const options: object = {
	language: "en",
	colors: true,
	debug: true,
	info: true,
	warning: true,
	error: true,
	sponsor: true,
	write: true,
	type: "log",
	rotate: {
		size: "10M",
		encoding: "utf8"
	},
	path: {
		debug_log: "./debug.log",
		error_log: "./errors.log"
	}
};

const logger = new Logger(options);

async function getInfo(): Promise<Prompt> {
	logger.info("Initializing prompts", "getInfo");
	const questions = [
		{
			type: "input",
			name: "FILENAME_Q",
			message: "Enter source videofile with extension"
		},
		{
			type: "input",
			name: "PALETTE_SIZE_Q",
			message: "Enter palette size (how many colors will be used) (<=64)"
		},
		{
			type: "input",
			name: "GIF_FPS_Q",
			message: "Enter desired GIF framerate (<=30)"
		},
		{
			type: "input",
			name: "VIDEO_TIMECODE_Q",
			message: "From where should we countdown (ss)"
		},
		{
			type: "input",
			name: "VIDEO_DESIRED_LENGTH_Q",
			message: "GIF length (ss)"
		}
	];

	const prompt = createPromptModule();
	const answer: Prompt = await prompt(questions);

	return answer;
}

async function main(): Promise<void> {
	let answer = await getInfo();

	const FILENAME_Q = answer["FILENAME_Q"];
	const PALETTE_SIZE_Q = answer["PALETTE_SIZE_Q"];
	const GIF_FPS_Q = answer["GIF_FPS_Q"];
	const VIDEO_TIMECODE_Q = answer["VIDEO_TIMECODE_Q"];
	const VIDEO_DESIRED_LENGTH_Q = answer["VIDEO_DESIRED_LENGTH_Q"];

	if (
		GIF_FPS_Q > 30 ||
		GIF_FPS_Q < 1 ||
		PALETTE_SIZE_Q > 64 ||
		PALETTE_SIZE_Q < 4 ||
		(VIDEO_TIMECODE_Q.length ||
			FILENAME_Q.length ||
			GIF_FPS_Q.toString().length ||
			VIDEO_DESIRED_LENGTH_Q.length ||
			PALETTE_SIZE_Q.toString().length) === 0
	) {
		logger.warning("Invalid input!", "main");
		answer = await getInfo();
	}

	logger.debug(`Debug data: File: ${FILENAME_Q} / GIF framerate: ${GIF_FPS_Q} / Palette size: ${PALETTE_SIZE_Q} / Video timecode: ${VIDEO_TIMECODE_Q} / Video length: ${VIDEO_DESIRED_LENGTH_Q}`);

	logger.warning("Clearing out temp directory", "main");
	for (const file of await readdirSync(".\\src\\temp")) {
		logger.sponsor(`Deleting file ${file}`, "main");
		await unlinkSync(join(".\\src\\temp", file));
	}

	logger.info("Cropping video to set length", "main");
	execSync(
		`.\\ffmpeg.exe -i .\\src\\input\\${FILENAME_Q} -ss ${VIDEO_TIMECODE_Q} -t ${VIDEO_DESIRED_LENGTH_Q} -c copy .\\src\\temp\\${FILENAME_Q.slice(0, -4)}-crop-temp${FILENAME_Q.slice(-4)}`,
		{ encoding: "utf-8" }
	);

	logger.info("Generating palette", "main");
	execSync(
		`.\\ffmpeg.exe -y -i .\\src\\temp\\${FILENAME_Q.slice(0, -4)}-crop-temp${FILENAME_Q.slice(-4)} -vf palettegen=max_colors=${PALETTE_SIZE_Q} .\\src\\temp\\${FILENAME_Q.slice(0, -4)}-palette.png`,
		{ encoding: "utf-8" }
	);

	logger.info("Resizing video to SayoDevice display resolution", "main");
	execSync(
		`.\\ffmpeg.exe -y -i .\\src\\temp\\${FILENAME_Q.slice(0, -4)}-crop-temp${FILENAME_Q.slice(-4)} -filter:v scale=160:80 -async 1 .\\src\\temp\\${FILENAME_Q.slice(0, -4)}-resized${FILENAME_Q.slice(-4)}`,
		{ encoding: "utf-8" }
	);

	logger.info("Generating GIF using palette", "main");
	execSync(
		`.\\ffmpeg.exe -y -i .\\src\\temp\\${FILENAME_Q.slice(0, -4)}-resized${FILENAME_Q.slice(-4)} -i .\\src\\temp\\${FILENAME_Q.slice(0, -4)}-palette.png -filter_complex paletteuse -r ${GIF_FPS_Q} -aspect 160:80 .\\src\\output\\${FILENAME_Q.slice(0, -4)}.gif`,
		{ encoding: "utf-8" }
	);

	logger.info("Done!");
}

main();
