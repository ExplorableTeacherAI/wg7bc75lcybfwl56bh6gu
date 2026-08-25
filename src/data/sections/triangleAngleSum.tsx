import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

export const triangleAngleSumBlocks: ReactElement[] = [
    <StackLayout key="layout-triangle-sum-heading" maxWidth="xl">
        <Block id="triangle-sum-heading" padding="md">
            <EditableH2 id="h2-triangle-sum-heading" blockId="triangle-sum-heading">
                Every Triangle Adds to 180
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-triangle-sum-setup" maxWidth="xl">
        <Block id="triangle-sum-setup" padding="sm">
            <EditableParagraph id="para-triangle-sum-setup" blockId="triangle-sum-setup">
                Every tiled pattern is built from corners, so start with the simplest shape that
                has any: a triangle. Three sides, three corners, and nothing simpler that still
                encloses space. Squash it, stretch it, make it long and thin, and one thing about
                those three corners quietly refuses to change.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-triangle-sum-visual" maxWidth="xl">
        <Block id="triangle-sum-visual">
            <VisualOptionCards
                blockId="triangle-sum-visual"
                cards={[
                    {
                        id: "corner-tear",
                        title: "The three corners of a triangle torn off and slid onto a straight line",
                        looks:
                            "Imagine a triangle with each of its three corners shaded a different colour, and a plain straight line drawn on the floor beneath it. As a corner is dragged down, it keeps its exact shape and size, and the pieces build up side by side into one wide angle.",
                        manipulate:
                            "Drag each shaded corner down to the line and push it up against the piece already there",
                        reveals:
                            "The three corners of any triangle fit together into a perfectly straight line, and a straight line is 180 degrees",
                        paradigm: "constructivist",
                        recommended: true,
                    },
                    {
                        id: "vertex-drag-bar",
                        title: "A triangle with three draggable corners, beside a bar built from its three angles",
                        looks:
                            "Imagine a triangle whose corners can be pulled anywhere, with each corner's size written next to it. Beside the shape, a bar stacks those three angles end to end against a fixed mark, and it stretches and shrinks as the triangle is reshaped.",
                        manipulate:
                            "Pull any corner of the triangle around and compare how far the bar moves with how much each angle changes",
                        reveals:
                            "Two angles can grow or shrink however they like, but the third always gives way so the total stays put",
                        paradigm: "comparison",
                        secondView: {
                            shows: "A bar stacking the three angles end to end against a fixed 180 mark",
                            role: "complementary",
                            syncedBy: "the shared triangle vertex variables, plus a shared hover highlight linking each angle to its band in the bar",
                        },
                    },
                    {
                        id: "hit-the-target",
                        title: "A triangle with a target size marked on one of its corners",
                        looks:
                            "Imagine a triangle with a target written on its top corner, such as 40 degrees, and the current size of all three corners shown as they change. The target corner glows when it is hit, and the other two corners keep adjusting the whole time.",
                        manipulate:
                            "Drag a corner until the top angle lands exactly on its target, then try to hit a second target as well",
                        reveals:
                            "The three angles share one fixed budget, so hitting a target with one corner forces the other two to make room",
                        paradigm: "goal",
                    },
                ]}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-triangle-sum-insight" maxWidth="xl">
        <Block id="triangle-sum-insight" padding="sm">
            <EditableParagraph id="para-triangle-sum-insight" blockId="triangle-sum-insight">
                The three angles of a triangle always total 180 degrees. Not roughly, and not
                usually: always, for every triangle that has ever been drawn. That one stubborn
                fact is the engine behind everything else in this lesson.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
