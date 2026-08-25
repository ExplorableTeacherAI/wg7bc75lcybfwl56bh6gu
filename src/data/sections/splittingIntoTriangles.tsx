import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

export const splittingIntoTrianglesBlocks: ReactElement[] = [
    <StackLayout key="layout-splitting-heading" maxWidth="xl">
        <Block id="splitting-heading" padding="md">
            <EditableH2 id="h2-splitting-heading" blockId="splitting-heading">
                Splitting a Shape into Triangles
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-setup" maxWidth="xl">
        <Block id="splitting-setup" padding="sm">
            <EditableParagraph id="para-splitting-setup" blockId="splitting-setup">
                A five-sided tile looks nothing like a triangle. But choose one of its corners,
                run straight lines from there to the corners it does not already touch, and the
                pentagon falls apart into triangles you already know how to handle.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-visual" maxWidth="xl">
        <Block id="splitting-visual">
            <VisualOptionCards
                blockId="splitting-visual"
                cards={[
                    {
                        id: "click-the-triangles",
                        title: "A hexagon criss-crossed with faint lines, so many overlapping triangles show at once",
                        looks:
                            "Imagine a hexagon with faint lines running across it in every direction, so dozens of triangles can be picked out at a glance. Every triangle a student chooses is filled with colour, and where two chosen triangles sit on top of each other the colour turns darker, while any part of the hexagon nobody has covered stays white.",
                        manipulate:
                            "Choose the triangles they think make up the hexagon, then look for dark patches and white gaps",
                        reveals:
                            "Only the triangles fanning out from one single corner cover the shape exactly once, with nothing doubled and nothing missed",
                        targetsMisconception:
                            "Students count every triangle they can see, not the ones that split the shape once",
                        paradigm: "prediction",
                        recommended: true,
                    },
                    {
                        id: "draw-the-splits",
                        title: "An empty pentagon whose corners can be joined up by hand",
                        looks:
                            "Imagine a plain pentagon with a small dot on each corner and nothing drawn inside it. Dragging from one dot to another leaves a line across the shape, and each finished triangle shades itself in, with a running count of triangles beside the shape.",
                        manipulate:
                            "Drag between corner dots to cut the pentagon up, and try to fill it using as few lines as possible",
                        reveals:
                            "Fanning out from one corner always leaves three triangles in a pentagon, and no arrangement of lines does it with fewer",
                        paradigm: "constructivist",
                    },
                    {
                        id: "which-corner",
                        title: "The same pentagon split from three different starting corners, side by side",
                        looks:
                            "Imagine three copies of the same pentagon in a row, each one already fanned into triangles from a different starting corner, with the triangles shaded and counted underneath. Moving the starting corner on any copy redraws its lines straight away.",
                        manipulate:
                            "Move the starting corner on each copy and compare the three counts underneath",
                        reveals:
                            "The triangles come out in different places but the count never changes, so the split does not depend on where you begin",
                        paradigm: "comparison",
                    },
                ]}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-insight" maxWidth="xl">
        <Block id="splitting-insight" padding="sm">
            <EditableParagraph id="para-splitting-insight" blockId="splitting-insight">
                This is where it gets slippery. Plenty of other triangles hide inside a polygon,
                sitting on top of one another, and it is tempting to count them all. Only the ones
                fanning out from a single corner count, because those are the pieces that cover
                the shape exactly once.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
