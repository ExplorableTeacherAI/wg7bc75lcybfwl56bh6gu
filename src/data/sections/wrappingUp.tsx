import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";

export const wrappingUpBlocks: ReactElement[] = [
    <StackLayout key="layout-wrapping-up-heading" maxWidth="xl">
        <Block id="wrapping-up-heading" padding="md">
            <EditableH2 id="h2-wrapping-up-heading" blockId="wrapping-up-heading">
                Wrapping Up
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapping-up-summary" maxWidth="xl">
        <Block id="wrapping-up-summary" padding="sm">
            <EditableParagraph id="para-wrapping-up-summary" blockId="wrapping-up-summary">
                So a polygon's corners were never a fresh mystery. Any straight-sided shape is a
                stack of triangles in disguise, and every triangle brings its unchanging 180
                degrees. Count the sides, take away two, multiply, and the total drops out,
                whether the shape is a neat pentagon or a lopsided nine-sided blob.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapping-up-next" maxWidth="xl">
        <Block id="wrapping-up-next" padding="sm">
            <EditableParagraph id="para-wrapping-up-next" blockId="wrapping-up-next">
                That is the whole trick, and it is why a tiler can plan a floor on paper before
                cutting anything. Next comes a single corner rather than the whole shape: when
                every corner of a polygon is identical, one angle is simply the total shared out
                evenly.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
