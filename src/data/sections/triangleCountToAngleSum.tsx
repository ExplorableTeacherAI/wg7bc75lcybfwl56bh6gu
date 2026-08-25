import { useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout, SplitLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useSpring } from "@/lib/motion";
import {
    getVariableInfo,
    clozePropsFromDefinition,
    numberPropsFromDefinition,
    linkedHighlightPropsFromDefinition,
} from "../variables";

/* ------------------------------------------------------------------ *
 * Two linked views of one idea: the fanned polygon, and the graph of
 * angle total against number of sides. Both read `polygonSideCount`
 * and `polygonViewHighlight` — that shared state IS the link.
 * ------------------------------------------------------------------ */

const MIN_SIDES = 3;
const MAX_SIDES = 12;

const TEAL = "#62D0AD";
const INK = "#334155";
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

            <g opacity={dim("total")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("total")}>
                <text x={CENTER.x} y={34} textAnchor="middle" fontSize="13" fill={INK}
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
                            fill={TEAL}
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
                        stroke={TEAL}
                        strokeWidth={fanActive ? 3 : 2}
                        strokeLinecap="round"
                        style={{ transition: "stroke-width 150ms ease-out" }}
                    />
                ))}
                <polygon
                    points={vertices.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke={STRUCTURE}
                    strokeWidth="2"
                    strokeLinejoin="round"
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
                    fill={totalActive ? INK : STRUCTURE}
                    fontWeight={totalActive ? 700 : 400}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`${sides - 2} triangles × 180° = ${totalFor(sides)}°`}
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
                <text x={24} y={34} fontSize="12" fill={STRUCTURE}>angle total</text>
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
                <text x={PLOT_RIGHT + 8} y={PLOT_BOTTOM + 42} textAnchor="end" fontSize="12" fill={STRUCTURE}>sides</text>
            </g>

            {/* The climb — one triangle, one step of 180 degrees */}
            <g opacity={dim("fan")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("fan")}>
                {fanActive && (
                    <line x1={plotX(MIN_SIDES)} y1={plotY(MIN_SIDES)} x2={plotX(MAX_SIDES)} y2={plotY(MAX_SIDES)}
                        stroke={TEAL} strokeWidth={9} opacity={0.28} strokeLinecap="round" />
                )}
                <line x1={plotX(MIN_SIDES)} y1={plotY(MIN_SIDES)} x2={plotX(MAX_SIDES)} y2={plotY(MAX_SIDES)}
                    stroke={TEAL} strokeWidth={fanActive ? 4 : 2.5} strokeLinecap="round"
                    style={{ transition: "stroke-width 150ms ease-out" }} />
                {allSides.map((value) => (
                    <circle key={`point-${value}`} cx={plotX(value)} cy={plotY(value)} r={3.5} fill={STRUCTURE} />
                ))}
                {sides > MIN_SIDES && (
                    <g>
                        <path d={`M ${stepFromX} ${stepFromY} L ${stepToX} ${stepFromY} L ${stepToX} ${stepToY}`}
                            fill="none" stroke={INK} strokeWidth={fanActive ? 2 : 1.5} strokeDasharray="4 4" strokeLinecap="round" />
                        <text x={stepLabelX} y={(stepFromY + stepToY) / 2 + 4} textAnchor={stepLabelAnchor}
                            fontSize="12" fill={INK} style={{ fontVariantNumeric: "tabular-nums" }}>
                            +180°
                        </text>
                    </g>
                )}
            </g>

            {/* The current shape, marked on the graph */}
            <g opacity={dim("total")} style={{ transition: "opacity 150ms ease-out" }} {...hoverProps("total")}>
                <line x1={PLOT_LEFT} y1={dotY} x2={dotX} y2={dotY} stroke={TEAL} strokeWidth={totalActive ? 2 : 1.5}
                    strokeDasharray="5 5" strokeLinecap="round" />
                <text x={dotX + (sides >= 10 ? -12 : 12)} y={dotY - 12} textAnchor={sides >= 10 ? "end" : "start"}
                    fontSize="13" fill={INK} fontWeight={totalActive ? 700 : 400}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`${totalFor(sides)}°`}
                </text>
                {totalActive && <circle cx={dotX} cy={dotY} r={18} fill={TEAL} opacity={0.28} />}
                <circle cx={dotX} cy={dotY} r={8 * dotScale} fill={TEAL} stroke="#FFFFFF" strokeWidth="2"
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
            caption="Drag the teal point around the rim to add or remove sides. The shape always fans into two fewer triangles than it has sides."
            onReset={() => setVar("polygonSideCount", 5)}
        >
            <FannedPolygonDrawing />
            <InteractionHintSequence
                hintKey="fanned-polygon-drag"
                steps={[
                    {
                        gesture: "drag-circular",
                        label: "Drag the teal point around the rim",
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
            caption="The same shape, plotted. Drag the teal dot sideways to change the number of sides and watch the total climb one 180 step at a time."
        >
            <AngleTotalGraphDrawing />
            <InteractionHintSequence
                hintKey="angle-total-graph-drag"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the teal dot along the line",
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
    return <span style={{ fontVariantNumeric: "tabular-nums" }}>{sides - 2}</span>;
}

function AngleTotalText() {
    const sides = useVar<number>("polygonSideCount", 5);
    return <span style={{ fontVariantNumeric: "tabular-nums" }}>{totalFor(sides)}</span>;
}

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
                A pentagon splits into three triangles, each carrying its own 180 degrees, so its
                five corners total 540. Drag the teal point around the rim to add and remove
                sides, and watch the{" "}
                <InlineLinkedHighlight
                    id="highlight-polygon-fan"
                    varName="polygonViewHighlight"
                    highlightId="fan"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('polygonViewHighlight'))}
                >
                    shaded triangles
                </InlineLinkedHighlight>
                {" "}and the{" "}
                <InlineLinkedHighlight
                    id="highlight-polygon-total"
                    varName="polygonViewHighlight"
                    highlightId="total"
                    showHint={false}
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('polygonViewHighlight'))}
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
                Count the sides, subtract two, multiply by 180. A shape with{" "}
                <InlineScrubbleNumber
                    varName="polygonSideCount"
                    {...numberPropsFromDefinition(getVariableInfo('polygonSideCount'))}
                />
                {" "}sides holds <TriangleCountText /> triangles and <AngleTotalText /> degrees,
                because every triangle sits on one side of the shape except the two sides meeting
                at the corner you fan from. That single rule handles a triangle, a hexagon, or a
                shape with a hundred sides.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-angle-sum-triangle-count" maxWidth="xl">
        <Block id="angle-sum-triangle-count" padding="sm">
            <EditableParagraph id="para-angle-sum-triangle-count" blockId="angle-sum-triangle-count">
                A road sign with 20 straight sides is far too big for the diagram, but the rule
                still holds: fanned from one corner it breaks into{" "}
                <InlineFeedback
                    varName="answerPolygonTriangleCount"
                    correctValue={["18", "eighteen"]}
                    position="terminal"
                    successMessage="— yes, always two fewer triangles than sides"
                    failureMessage="— not quite."
                    hint="Compare the two numbers in the shape as you change it: sides, and triangles"
                    visualizationHint={{
                        blockId: "angle-sum-visual",
                        hintKey: "feedback-fanned-polygon",
                        label: "Discover it yourself",
                        resetVars: { polygonSideCount: 4 },
                        steps: [
                            {
                                gesture: "drag-circular",
                                label: "Drag the teal point until the shape has 7 sides — count the shaded triangles",
                                position: { x: "78%", y: "49%" },
                                completionVar: "polygonSideCount",
                                completionValue: 7,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "drag-circular",
                                label: "Now stretch it to 11 sides — the triangle count stays two behind",
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
                Every one of those triangles brings 180 degrees, so the corners of that 20-sided
                sign total{" "}
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
