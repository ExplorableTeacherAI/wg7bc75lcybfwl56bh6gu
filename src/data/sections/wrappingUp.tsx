import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph, Table } from "@/components/atoms";
import { FormulaBlock } from "@/components/molecules";
import { scrubVarsFromDefinitions } from "../variables";

export const wrappingUpBlocks: ReactElement[] = [
    <StackLayout key="layout-wrapping-up-heading" maxWidth="xl">
        <Block id="wrapping-up-heading" padding="md">
            <EditableH2 id="h2-wrapping-up-heading" blockId="wrapping-up-heading">
                Summary: The Interior Angle Sum Formula
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapping-up-summary" maxWidth="xl">
        <Block id="wrapping-up-summary" padding="sm">
            <EditableParagraph id="para-wrapping-up-summary" blockId="wrapping-up-summary">
                Two theorems carry every exam question on this topic. The interior angles of any
                triangle sum to 180 degrees, whatever its shape. A polygon with n sides
                triangulates into n minus 2 triangles from a single vertex, so its interior angle
                sum S is that count times 180 degrees.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapping-up-formula" maxWidth="xl">
        <Block id="wrapping-up-formula" padding="lg">
            <FormulaBlock
                latex="\textcolor{#8E90F5}{S} = (\scrub{polygonSideCount} - 2) \times 180^\circ = \val{polygonAngleTotal}^\circ"
                variables={scrubVarsFromDefinitions(['polygonSideCount', 'polygonAngleTotal'])}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-wrapping-up-reference" maxWidth="xl">
        <Block id="wrapping-up-reference" padding="sm">
            <Table
                columns={[
                    { header: 'Shape', align: 'left' },
                    { header: 'Sides', align: 'center', width: 90 },
                    { header: 'Triangles', align: 'center', width: 110 },
                    { header: 'Interior angle sum', align: 'center', width: 150 },
                ]}
                rows={[
                    { cells: ['Triangle', 3, 1, '180°'] },
                    { cells: ['Quadrilateral', 4, 2, '360°'] },
                    { cells: ['Pentagon', 5, 3, '540°'] },
                    { cells: ['Hexagon', 6, 4, '720°'] },
                    { cells: ['Decagon', 10, 8, '1440°'] },
                    { cells: ['Any n-gon', 'n', 'n − 2', '(n − 2) × 180°'], highlight: true },
                ]}
                color="#62D0AD"
                caption="Quick reference — sides, triangles in the triangulation, and interior angle sum"
            />
        </Block>
    </StackLayout>,

];
