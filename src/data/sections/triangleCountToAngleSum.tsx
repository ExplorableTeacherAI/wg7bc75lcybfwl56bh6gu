import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

export const triangleCountToAngleSumBlocks: ReactElement[] = [
    <StackLayout key="layout-angle-sum-heading" maxWidth="xl">
        <Block id="angle-sum-heading" padding="md">
            <EditableH2 id="h2-angle-sum-heading" blockId="angle-sum-heading">
                From Triangle Count to Angle Sum
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-angle-sum-setup" maxWidth="xl">
        <Block id="angle-sum-setup" padding="sm">
            <EditableParagraph id="para-angle-sum-setup" blockId="angle-sum-setup">
                A pentagon splits into three triangles. Each triangle carries its own 180 degrees,
                and none of that goes to waste, so a pentagon's five corners must total 540. The
                interesting part is what happens to that total as shapes gain more sides.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-angle-sum-visual" maxWidth="xl">
        <Block id="angle-sum-visual">
            <VisualOptionCards
                blockId="angle-sum-visual"
                cards={[
                    {
                        id: "sides-and-total-graph",
                        title: "A shape that gains and loses sides, next to a graph of sides against angle total",
                        looks:
                            "Imagine a shape already fanned into shaded triangles, with a handle on its edge that adds another side or takes one away. Beside it, a graph plots the number of sides against the angle total, and a dot marks the current shape as new points appear in a perfectly straight climb.",
                        manipulate:
                            "Drag the handle to add and remove sides, and watch the dot climb the graph one step at a time",
                        reveals:
                            "Each extra side adds exactly one triangle and exactly 180 degrees, which is why the points climb in a straight line",
                        paradigm: "conventional",
                        recommended: true,
                        secondView: {
                            shows: "A graph of angle total against number of sides, with the current shape marked",
                            role: "complementary",
                            syncedBy: "the shared side-count variable, plus a shared hover highlight linking a triangle in the shape to its 180 step on the graph",
                        },
                    },
                    {
                        id: "reach-the-total",
                        title: "A target angle total with a shape that rebuilds itself to match",
                        looks:
                            "Imagine a large number such as 900 degrees written above an empty frame, and a stack of 180 degree blocks beneath it. As blocks are added the shape in the frame grows a side for every block, so it is always the shape that those triangles would make.",
                        manipulate:
                            "Add or remove 180 degree blocks until the running total reaches the target, then read off how many sides the shape ended up with",
                        reveals:
                            "Working backwards from a total tells you the shape, because the number of triangles is always two fewer than the number of sides",
                        paradigm: "inversion",
                    },
                    {
                        id: "grow-one-side",
                        title: "A triangle growing into a square, pentagon and hexagon, one side at a time",
                        looks:
                            "Imagine a triangle with its 180 degrees written underneath. Stepping forward pushes out one new side, a fresh triangle sweeps into the shape in its own colour, and the running total underneath ticks up by another 180 with each step.",
                        manipulate:
                            "Step the shape forward and back one side at a time, pausing to read the running total",
                        reveals:
                            "A shape with a given number of sides always breaks into two fewer triangles, so the total is that count times 180",
                        paradigm: "temporal",
                    },
                ]}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-angle-sum-rule" maxWidth="xl">
        <Block id="angle-sum-rule" padding="sm">
            <EditableParagraph id="para-angle-sum-rule" blockId="angle-sum-rule">
                Count the sides, subtract two, multiply by 180. The subtraction is there because a
                shape with a given number of sides always breaks into two fewer triangles than
                that. One rule handles a triangle, a hexagon, or a shape with a hundred sides.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
