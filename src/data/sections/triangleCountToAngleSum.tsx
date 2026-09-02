import { useEffect, useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout, SplitLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InlineSpotColor,
    InlineTooltip,
    InlineTrigger,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure, FormulaBlock } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useSpring } from "@/lib/motion";
import {
    getVariableInfo,
    clozePropsFromDefinition,
    numberPropsFromDefinition,
    linkedHighlightPropsFromDefinition,
    spotColorPropsFromDefinition,
    scrubVarsFromDefinitions,
} from "../variables";

/* ------------------------------------------------------------------ *
 * Two linked views of one idea: the fanned polygon, and the graph of
 * angle total against number of sides. Both read `polygonSideCount`
 * and `polygonViewHighlight` — that shared state IS the link.
 * ------------------------------------------------------------------ */

const MIN_SIDES = 3;
const MAX_SIDES = 12;

const TEAL = "#62D0AD";     // the sides — the quantity the student changes
const VIOLET = "#AC8BF9";   // the triangles the shape fans into
const INDIGO = "#8E90F5";   // the angle total those triangles add up to
const STRUCTURE = "#64748B";

const VIEW = 380;
const CENTER = { x: 190, y: 186 };
const RADIUS = 108;
const START_ANGLE = -90;

const PLOT_LEFT = 82;
const PLOT_RIGHT = 340;
const PLOT_BOTTOM = 300;
const PIXELS_PER_DEGREE = 240 / 1800;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const totalFor = (sides: number) => (sides - 2) * 180;
const plotX = (sides: number) => PLOT_LEFT + ((sides - MIN_SIDES) / (MAX_SIDES - MIN_SIDES)) * (PLOT_RIGHT - PLOT_LEFT);
const plotY = (sides: number) => PLOT_BOTTOM - totalFor(sides) * PIXELS_PER_DEGREE;

/** Shared highlight behaviour: the named part pops, everything else recedes. */
function useLinkedHighlight() {
    const highlight = useVar<string>("polygonViewHighlight", "");
    const setVar = useSetVar();
    return {
        isActive: (id: string) => highlight === id,
        dim: (id: string) => (highlight && highlight !== id ? 0.35 : 1),
        hoverProps: (id: string) => ({
            onPointerEnter: () => setVar("polygonViewHighlight", id),
            onPointerLeave: () => setVar("polygonViewHighlight", ""),
        }),
    };
}

function FannedPolygonDrawing() {
    const setVar = useSetVar();
    const sides = useVar<number>("polygonSideCount", 5);
    const { isActive, dim, hoverProps } = useLinkedHighlight();
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);

    // Keep the shared readouts in step with the shape, so every formula and
    // sentence on the page shows the same numbers as this drawing.
    useEffect(() => {
        setVar("polygonTriangleCount", sides - 2);
        setVar("polygonAngleTotal", totalFor(sides));
    }, [setVar, sides]);

    const growth = useSpring(sides, { stiffness: 200, damping: 22 });
    const newestPiece = clamp(growth - (sides - 1), 0, 1);
    const handleScale = useSpring(dragging || hovered || isActive("handle") ? 1.3 : 1, {
        stiffness: 400,
        damping: 26,
    });

    const vertexAt = (index: number) => {
        const angle = toRadians(START_ANGLE + (index * 360) / sides);
        return { x: CENTER.x + RADIUS * Math.cos(angle), y: CENTER.y + RADIUS * Math.sin(angle) };
    };

    const vertices = Array.from({ length: sides }, (_, index) => vertexAt(index));
    const triangles = Array.from({ length: sides - 2 }, (_, index) => index + 1);
    const fanActive = isActive("fan");
    const totalActive = isActive("total");
    const sidesActive = isActive("sides");

    const moveHandle = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!dragging) return;
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const px = ((event.clientX - rect.left) / rect.width) * VIEW;
        const py = ((event.clientY - rect.top) / rect.height) * VIEW;
        const pointerAngle = (Math.atan2(py - CENTER.y, px - CENTER.x) * 180) / Math.PI;
        let spacing = pointerAngle - START_ANGLE;
        while (spacing < 0) spacing += 360;
        while (spacing >= 360) spacing -= 360;
        spacing = clamp(spacing, 360 / MAX_SIDES, 360 / MIN_SIDES);
        setVar("polygonSideCount", clamp(Math.round(360 / spacing), MIN_SIDES, MAX_SIDES));
    };

    const handlePoint = vertices[1];

    return (
        <svg ref={svgRef} viewBox={`0 0 ${VIEW} ${VIEW}`} className="block w-full">
            <defs>
                <filter id="polygon-handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <g opacity={dim("sides")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("sides")}>
                <text x={CENTER.x} y={34} textAnchor="middle" fontSize="13" fill={TEAL}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`${sides} sides`}
                </text>
            </g>

            {/* The fan of triangles — the counterpart of the graph's rise */}
            <g opacity={dim("fan")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("fan")}>
                {triangles.map((index) => {
                    const isNewest = index === sides - 2;
                    const points = `${vertices[0].x},${vertices[0].y} ${vertices[index].x},${vertices[index].y} ${vertices[index + 1].x},${vertices[index + 1].y}`;
                    return (
                        <polygon
                            key={`triangle-${index}`}
                            points={points}
                            fill={VIOLET}
                            fillOpacity={(index % 2 === 0 ? 0.18 : 0.3) + (fanActive ? 0.16 : 0)}
                            opacity={isNewest ? newestPiece : 1}
                            style={{ transition: "fill-opacity 150ms ease-out" }}
                        />
                    );
                })}
                {triangles.slice(1).map((index) => (
                    <line
                        key={`diagonal-${index}`}
                        x1={vertices[0].x}
                        y1={vertices[0].y}
                        x2={vertices[index].x}
                        y2={vertices[index].y}
                        stroke={VIOLET}
                        strokeWidth={fanActive ? 3 : 2}
                        strokeLinecap="round"
                        style={{ transition: "stroke-width 150ms ease-out" }}
                    />
                ))}
            </g>

            {/* The rim — the sides being counted */}
            <g opacity={dim("sides")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("sides")}>
                <polygon
                    points={vertices.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke={TEAL}
                    strokeWidth={sidesActive ? 3.5 : 2}
                    strokeLinejoin="round"
                    style={{ transition: "stroke-width 150ms ease-out" }}
                />
            </g>

            {/* Draggable handle that adds and removes sides */}
            <g opacity={dim("handle")} style={{ transition: "opacity 150ms ease-out" }}>
            {(dragging || hovered || isActive("handle")) && (
                <circle cx={handlePoint.x} cy={handlePoint.y} r={22} fill={TEAL} opacity={0.28} />
            )}
            <circle
                cx={handlePoint.x}
                cy={handlePoint.y}
                r={11 * handleScale}
                fill={TEAL}
                stroke="#FFFFFF"
                strokeWidth="2"
                filter="url(#polygon-handle-shadow)"
            />
            <circle
                cx={handlePoint.x}
                cy={handlePoint.y}
                r={22}
                fill="transparent"
                style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(true);
                }}
                onPointerMove={moveHandle}
                onPointerUp={() => setDragging(false)}
                onPointerCancel={() => setDragging(false)}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            />
            </g>

            <g opacity={dim("total")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("total")}>
                <text x={CENTER.x} y={356} textAnchor="middle" fontSize="13"
                    fontWeight={totalActive ? 700 : 400}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    <tspan fill={VIOLET}>{`${sides - 2} triangles`}</tspan>
                    <tspan fill={STRUCTURE}>{" × 180° = "}</tspan>
                    <tspan fill={INDIGO}>{`${totalFor(sides)}°`}</tspan>
                </text>
            </g>
        </svg>
    );
}

function AngleTotalGraphDrawing() {
    const setVar = useSetVar();
    const sides = useVar<number>("polygonSideCount", 5);
    const { isActive, dim, hoverProps } = useLinkedHighlight();
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);

    const glide = useSpring(sides, { stiffness: 200, damping: 22 });
    const dotScale = useSpring(dragging || hovered || isActive("total") ? 1.3 : 1, { stiffness: 400, damping: 26 });

    const allSides = Array.from({ length: MAX_SIDES - MIN_SIDES + 1 }, (_, index) => MIN_SIDES + index);
    const dotX = plotX(glide);
    const dotY = PLOT_BOTTOM - totalFor(glide) * PIXELS_PER_DEGREE;
    const fanActive = isActive("fan");
    const totalActive = isActive("total");

    const moveDot = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!dragging) return;
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const px = ((event.clientX - rect.left) / rect.width) * VIEW;
        const fraction = (px - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT);
        setVar("polygonSideCount", clamp(Math.round(MIN_SIDES + fraction * (MAX_SIDES - MIN_SIDES)), MIN_SIDES, MAX_SIDES));
    };

    const stepFromX = plotX(Math.max(MIN_SIDES, sides - 1));
    const stepFromY = plotY(Math.max(MIN_SIDES, sides - 1));
    const stepToX = plotX(sides);
    const stepToY = plotY(sides);
    const stepLabelAnchor = sides >= 10 ? "end" : "start";
    const stepLabelX = sides >= 10 ? stepToX - 8 : stepToX + 8;

    return (
        <svg ref={svgRef} viewBox={`0 0 ${VIEW} ${VIEW}`} className="block w-full">
            <defs>
                <filter id="graph-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Axes and scale */}
            <g opacity={dim("axes")} style={{ transition: "opacity 150ms ease-out" }}>
                <text x={24} y={34} fontSize="12" fill={INDIGO}>angle total</text>
                <line x1={PLOT_LEFT} y1={52} x2={PLOT_LEFT} y2={PLOT_BOTTOM} stroke={STRUCTURE} strokeWidth="1.5" strokeLinecap="round" />
                <line x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT + 8} y2={PLOT_BOTTOM} stroke={STRUCTURE} strokeWidth="1.5" strokeLinecap="round" />
                {[0, 900, 1800].map((value) => (
                    <text key={`y-${value}`} x={70} y={PLOT_BOTTOM - value * PIXELS_PER_DEGREE + 4} textAnchor="end"
                        fontSize="12" fill={STRUCTURE} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {`${value}°`}
                    </text>
                ))}
                {[3, 6, 9, 12].map((value) => (
                    <text key={`x-${value}`} x={plotX(value)} y={PLOT_BOTTOM + 20} textAnchor="middle"
                        fontSize="12" fill={STRUCTURE} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {value}
                    </text>
                ))}
            </g>

            {/* The side count along the bottom */}
            <g opacity={dim("sides")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("sides")}>
                <text x={PLOT_RIGHT + 8} y={PLOT_BOTTOM + 42} textAnchor="end" fontSize="12" fill={TEAL}
                    fontWeight={isActive("sides") ? 700 : 400}>
                    sides
                </text>
            </g>

            {/* The climb — the angle total, side by side with the shape */}
            <g opacity={dim("total")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("total")}>
                {totalActive && (
                    <line x1={plotX(MIN_SIDES)} y1={plotY(MIN_SIDES)} x2={plotX(MAX_SIDES)} y2={plotY(MAX_SIDES)}
                        stroke={INDIGO} strokeWidth={9} opacity={0.28} strokeLinecap="round" />
                )}
                <line x1={plotX(MIN_SIDES)} y1={plotY(MIN_SIDES)} x2={plotX(MAX_SIDES)} y2={plotY(MAX_SIDES)}
                    stroke={INDIGO} strokeWidth={totalActive ? 4 : 2.5} strokeLinecap="round"
                    style={{ transition: "stroke-width 150ms ease-out" }} />
                {allSides.map((value) => (
                    <circle key={`point-${value}`} cx={plotX(value)} cy={plotY(value)} r={3.5} fill={STRUCTURE} />
                ))}
            </g>

            {/* One triangle, one step of 180 degrees */}
            <g opacity={dim("fan")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("fan")}>
                {sides > MIN_SIDES && (
                    <g>
                        {fanActive && (
                            <path d={`M ${stepFromX} ${stepFromY} L ${stepToX} ${stepFromY} L ${stepToX} ${stepToY}`}
                                fill="none" stroke={VIOLET} strokeWidth={8} opacity={0.28} strokeLinecap="round" />
                        )}
                        <path d={`M ${stepFromX} ${stepFromY} L ${stepToX} ${stepFromY} L ${stepToX} ${stepToY}`}
                            fill="none" stroke={VIOLET} strokeWidth={fanActive ? 3 : 1.5} strokeDasharray="4 4" strokeLinecap="round"
                            style={{ transition: "stroke-width 150ms ease-out" }} />
                        <text x={stepLabelX} y={(stepFromY + stepToY) / 2 + 4} textAnchor={stepLabelAnchor}
                            fontSize="12" fill={VIOLET} fontWeight={fanActive ? 700 : 400}
                            style={{ fontVariantNumeric: "tabular-nums" }}>
                            +180°
                        </text>
                    </g>
                )}
            </g>

            {/* The current shape, marked on the graph */}
            <g opacity={dim("total")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("total")}>
                <line x1={PLOT_LEFT} y1={dotY} x2={dotX} y2={dotY} stroke={INDIGO} strokeWidth={totalActive ? 2 : 1.5}
                    strokeDasharray="5 5" strokeLinecap="round" />
                <text x={dotX + (sides >= 10 ? -12 : 12)} y={dotY - 12} textAnchor={sides >= 10 ? "end" : "start"}
                    fontSize="13" fill={INDIGO} fontWeight={totalActive ? 700 : 400}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`${totalFor(sides)}°`}
                </text>
                {totalActive && <circle cx={dotX} cy={dotY} r={18} fill={INDIGO} opacity={0.28} />}
                <circle cx={dotX} cy={dotY} r={8 * dotScale} fill={INDIGO} stroke="#FFFFFF" strokeWidth="2"
                    filter="url(#graph-dot-shadow)" />
                <circle cx={dotX} cy={dotY} r={20} fill="transparent"
                    style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setDragging(true);
                    }}
                    onPointerMove={moveDot}
                    onPointerUp={() => setDragging(false)}
                    onPointerCancel={() => setDragging(false)}
                    onPointerEnter={() => setHovered(true)}
                    onPointerLeave={() => setHovered(false)} />
            </g>
        </svg>
    );
}

function FannedPolygonFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="fanned-polygon"
            caption="Drag the teal vertex around the rim to add or remove sides. The polygon always triangulates into two fewer triangles than it has sides."
            onReset={() => setVar("polygonSideCount", 5)}
        >
            <FannedPolygonDrawing />
            <InteractionHintSequence
                hintKey="fanned-polygon-drag"
                steps={[
                    {
                        gesture: "drag-circular",
                        label: "Drag the teal vertex around the rim",
                        position: { x: "77%", y: "40%" },
                        dragPath: { type: "arc", startAngle: -30, endAngle: 40, radius: 34 },
                    },
                ]}
            />
        </Figure>
    );
}

function AngleTotalGraphFigure() {
    return (
        <Figure
            id="angle-total-graph"
            caption="The same polygon, plotted. Drag the indigo dot sideways to change n and watch the angle sum climb in steps of 180 degrees."
        >
            <AngleTotalGraphDrawing />
            <InteractionHintSequence
                hintKey="angle-total-graph-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the indigo dot along the line",
                        position: { x: "37%", y: "60%" },
                        dragPath: { type: "line", startOffset: { x: -26, y: 12 }, endOffset: { x: 26, y: -12 } },
                    },
                ]}
            />
        </Figure>
    );
}

/** Live readouts so the sentence stays true at every number of sides. */
function TriangleCountText() {
    const sides = useVar<number>("polygonSideCount", 5);
    return (
        <span style={{ color: VIOLET, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {sides - 2}
        </span>
    );
}

function AngleTotalText() {
    const sides = useVar<number>("polygonSideCount", 5);
    return (
        <span style={{ color: INDIGO, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {totalFor(sides)}
        </span>
    );
}

export const triangleCountToAngleSumBlocks: ReactElement[] = [
    <StackLayout key="layout-angle-sum-heading" maxWidth="xl">
        <Block id="angle-sum-heading" padding="md">
            <EditableH2 id="h2-angle-sum-heading" blockId="angle-sum-heading">
                Deriving the (n − 2) × 180° Formula
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-angle-sum-setup" maxWidth="xl">
        <Block id="angle-sum-setup" padding="sm">
            <EditableParagraph id="para-angle-sum-setup" blockId="angle-sum-setup">
                A pentagon triangulates into three triangles, each carrying its own 180 degrees,
                so its five interior angles sum to 540. Drag the teal vertex around the rim to add
                and remove sides, and watch the{" "}
                <InlineLinkedHighlight
                    id="highlight-polygon-fan"
                    varName="polygonViewHighlight"
                    highlightId="fan"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('polygonTriangleCount'))}
                >
                    shaded triangles
                </InlineLinkedHighlight>
                {" "}and the{" "}
                <InlineLinkedHighlight
                    id="highlight-polygon-total"
                    varName="polygonViewHighlight"
                    highlightId="total"
                    showHint={false}
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('polygonAngleTotal'))}
                >
                    running total
                </InlineLinkedHighlight>
                {" "}move together.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <SplitLayout key="layout-angle-sum-linked-views" ratio="1:1" gap="lg" align="start">
        <Block id="angle-sum-visual" padding="sm" hasVisualization>
            <FannedPolygonFigure />
        </Block>
        <Block id="angle-sum-graph" padding="sm" hasVisualization>
            <AngleTotalGraphFigure />
        </Block>
    </SplitLayout>,

    <StackLayout key="layout-angle-sum-rule" maxWidth="xl">
        <Block id="angle-sum-rule" padding="sm">
            <EditableParagraph id="para-angle-sum-rule" blockId="angle-sum-rule">
                Count the{" "}
                <InlineLinkedHighlight
                    id="highlight-polygon-sides"
                    varName="polygonViewHighlight"
                    highlightId="sides"
                    showHint={false}
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('polygonSideCount'))}
                >
                    sides
                </InlineLinkedHighlight>
                , subtract two, multiply by 180. A{" "}
                <InlineTooltip id="tooltip-convex-polygon" tooltip="A convex polygon: one with no dents, so every diagonal drawn from a vertex stays inside the shape.">
                    convex
                </InlineTooltip>
                {" "}polygon with{" "}
                <InlineScrubbleNumber
                    varName="polygonSideCount"
                    {...numberPropsFromDefinition(getVariableInfo('polygonSideCount'))}
                />
                {" "}sides holds <TriangleCountText />{" "}
                <InlineSpotColor
                    varName="polygonTriangleCount"
                    {...spotColorPropsFromDefinition(getVariableInfo('polygonTriangleCount'))}
                    id="spotColor-polygon-triangles"
                >
                    triangles
                </InlineSpotColor>
                {" "}and <AngleTotalText />{" "}
                <InlineSpotColor
                    varName="polygonAngleTotal"
                    {...spotColorPropsFromDefinition(getVariableInfo('polygonAngleTotal'))}
                    id="spotColor-polygon-total"
                >
                    degrees
                </InlineSpotColor>
                , because each triangle rests on one side of the polygon except the two sides
                meeting at the vertex you{" "}
                <InlineTooltip id="tooltip-fan" tooltip="Triangulating from a vertex: drawing every diagonal from that one vertex, so the polygon splits into triangles covering it exactly once.">
                    triangulate from
                </InlineTooltip>
                . The same derivation handles{" "}
                <InlineTrigger id="trigger-sides-triangle" varName="polygonSideCount" value={3}>
                    a triangle
                </InlineTrigger>
                ,{" "}
                <InlineTrigger id="trigger-sides-hexagon" varName="polygonSideCount" value={6} icon="none">
                    a hexagon
                </InlineTrigger>
                , or a 100-gon.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-angle-sum-formula" maxWidth="xl">
        <Block id="angle-sum-formula" padding="lg">
            <FormulaBlock
                latex="(\scrub{polygonSideCount} - 2) \times 180^\circ = \val{polygonTriangleCount} \times 180^\circ = \val{polygonAngleTotal}^\circ"
                variables={scrubVarsFromDefinitions(['polygonSideCount', 'polygonTriangleCount', 'polygonAngleTotal'])}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-angle-sum-triangle-count" maxWidth="xl">
        <Block id="angle-sum-triangle-count" padding="sm">
            <EditableParagraph id="para-angle-sum-triangle-count" blockId="angle-sum-triangle-count">
                A 20-gon is far too big for the diagram, but the derivation still holds:
                triangulated from one vertex it decomposes into{" "}
                <InlineFeedback
                    varName="answerPolygonTriangleCount"
                    correctValue={["18", "eighteen"]}
                    position="terminal"
                    successMessage="— yes, the triangulation always has two fewer triangles than the polygon has sides"
                    failureMessage="— not quite."
                    hint="Compare the two readouts as you reshape the polygon: n, and the triangle count"
                    visualizationHint={{
                        blockId: "angle-sum-visual",
                        hintKey: "feedback-fanned-polygon",
                        label: "Discover it yourself",
                        resetVars: { polygonSideCount: 4 },
                        steps: [
                            {
                                gesture: "drag-circular",
                                label: "Drag the teal vertex until the polygon has 7 sides — count the shaded triangles",
                                position: { x: "78%", y: "49%" },
                                completionVar: "polygonSideCount",
                                completionValue: 7,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "drag-circular",
                                label: "Now extend it to 11 sides — the triangle count stays two behind n",
                                position: { x: "72%", y: "31%" },
                                completionVar: "polygonSideCount",
                                completionValue: 11,
                                completionTolerance: 0.4,
                            },
                        ],
                    }}
                >
                    <InlineClozeInput
                        varName="answerPolygonTriangleCount"
                        correctAnswer={["18", "eighteen"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerPolygonTriangleCount'))}
                    />
                </InlineFeedback>
                {" "}triangles.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-angle-sum-total" maxWidth="xl">
        <Block id="angle-sum-total" padding="sm">
            <EditableParagraph id="para-angle-sum-total" blockId="angle-sum-total">
                Every one of those triangles contributes 180 degrees, so the interior angles of
                that 20-gon sum to{" "}
                <InlineFeedback
                    varName="answerPolygonAngleTotal"
                    correctValue={["3240", "3240°", "3240 degrees"]}
                    position="terminal"
                    successMessage="— correct, 18 triangles at 180 degrees each"
                    failureMessage="— close, but check the multiplication."
                    hint="18 × 180 is 18 × 18 with a zero on the end"
                    reviewBlockId="angle-sum-graph"
                    reviewLabel="Back to the graph"
                >
                    <InlineClozeInput
                        varName="answerPolygonAngleTotal"
                        correctAnswer={["3240", "3240°", "3240 degrees"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerPolygonAngleTotal'))}
                    />
                </InlineFeedback>
                {" "}degrees.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
