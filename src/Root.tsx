import React from "react";
import { Composition, Folder } from "remotion";
import {
  DemoShort,
  DemoShortWithCaptions,
  DemoFrames,
} from "./videos/demo/Bridge";
import { DemoCaptionOverlay } from "./videos/demo/DemoCaptionOverlay";
import { DemoCaptionsOnly } from "./videos/demo/CaptionsOnly";
import { DuaTiketShort, DuaTiketWithSubtitles, DUATIKET_FRAMES } from "./videos/duatiket/Bridge";
import { DuaTiketSubtitles } from "./videos/duatiket/Subtitles";

export const Root: React.FC = () => {
  return (
    <>
      <Folder name="DuaTiket">
        <Composition id="DuaTiket" component={DuaTiketShort} durationInFrames={DUATIKET_FRAMES} fps={30} width={1080} height={1920} />
        <Composition id="DuaTiketWithSubtitles" component={DuaTiketWithSubtitles} durationInFrames={DUATIKET_FRAMES} fps={30} width={1080} height={1920} />
        <Composition id="DuaTiketSubtitles" component={DuaTiketSubtitles} durationInFrames={DUATIKET_FRAMES} fps={30} width={1080} height={1920} />
        <Composition id="DuaTiketSubtitlesGreen" component={() => <DuaTiketSubtitles bg="#00FF00" />} durationInFrames={DUATIKET_FRAMES} fps={30} width={1080} height={1920} />
      </Folder>
      <Folder name="Demo">
        <Composition
          id="DemoShort"
          component={DemoShort}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DemoShortWithCaptions"
          component={DemoShortWithCaptions}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DemoCaptionOverlay"
          component={DemoCaptionOverlay}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DemoCaptionGreenScreen"
          component={() => <DemoCaptionOverlay bg="#00FF00" />}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DemoCaptions"
          component={DemoCaptionsOnly}
          durationInFrames={DemoFrames}
          fps={30}
          width={1080}
          height={1920}
        />
      </Folder>
    </>
  );
};
