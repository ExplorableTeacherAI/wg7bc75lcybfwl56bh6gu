import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH1, EditableParagraph, InlineTooltip } from "@/components/atoms";

export const anglesInPolygonsOrientBlocks: ReactElement[] = [
    <StackLayout key="layout-orient-title" maxWidth="xl">
        <Block id="orient-title" padding="md">
            <EditableH1 id="h1-orient-title" blockId="orient-title">
                Interior Angle Sums in Polygons
            </EditableH1>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-orient-promise" maxWidth="xl">
        <Block id="orient-promise" padding="sm">
            <EditableParagraph id="para-orient-promise" blockId="orient-promise">Any flat shape bounded by straight sides is a <InlineTooltip id="tooltip-polygon" tooltip="A polygon: a closed flat shape whose boundary is made of straight line segments.">polygon</InlineTooltip>, and every vertex of it holds an <InlineTooltip id="tooltip-interior-angle" tooltip="An interior angle: the angle inside the polygon at one of its vertices, between the two sides that meet there.">interior angle</InlineTooltip>. Count the sides and you can predict what all of those angles sum to, without measuring a single one. The route runs through <InlineTooltip id="tooltip-triangulation" tooltip="Triangulation: dividing a polygon into triangles that cover it exactly once, with no gaps and no overlaps.">triangulation</InlineTooltip>, cutting the polygon into triangles. If you can multiply and subtract small numbers, you have everything you need.</EditableParagraph>
        </Block>
    </StackLayout>,
];
