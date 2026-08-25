import { useRef, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineSpotColor,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useSpring } from "@/lib/motion";
import {
    getVariableInfo,
    clozePropsFromDefinition,
    choicePropsFromDefinition,
    spotColorPropsFromDefinition,
    linkedHighlightPropsFromDefinition,
} from "../variables";

/* ------------------------------------------------------------------ *
 * Corner-tear figure — the three corners of any triangle, dragged
 * down onto a straight line.
 * ------------------------------------------------------------------ */

const VIEW_W = 560;
const VIEW_H = 380;
const BASE_Y = 250;
const LEFT_CORNER = { x: 150, y: BASE_Y };
const RIGHT_CORNER = { x: 430, y: BASE_Y };
const LINE_Y = 330;
const LINE_ORIGIN = { x: 280, y: LINE_Y };
const WEDGE_R = 34;
const SLOT_SCALE = 46 / WEDGE_R;

const TEAL = "#62D0AD";
const INDIGO = "#8E90F5";
const VIOLET = "#AC8BF9";
const INK = "#334155";
const STRUCTURE = "#64748B";

const APEX_X_MIN = 70;
const APEX_X_MAX = 490;
const APEX_Y_MIN = 70;
const APEX_Y_MAX = 200;

type Point = { x: number; y: number };

const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const shortestTurn = (degrees: number) => {
    let value = degrees;
    while (value > 180) value -= 360;
    while (value <= -180) value += 360;
    return value;
};

/** Sector from local angle 0 to +theta, radius r, apex at the local origin. */
const sectorPath = (theta: number, r: number) => {
    const largeArc = theta > Math.PI ? 1 : 0;
    return `M 0 0 L ${r} 0 A ${r} ${r} 0 ${largeArc} 1 ${(r * Math.cos(theta)).toFixed(2)} ${(r * Math.sin(theta)).toFixed(2)} Z`;
};

/** Ring-shaped grab area so the vertex handle underneath stays reachable. */
const annulusPath = (theta: number, inner: number, outer: number) => {
    const largeArc = theta > Math.PI ? 1 : 0;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    return [
        `M ${inner} 0`,
        `L ${outer} 0`,
        `A ${outer} ${outer} 0 ${largeArc} 1 ${(outer * cos).toFixed(2)} ${(outer * sin).toFixed(2)}`,
        `L ${(inner * cos).toFixed(2)} ${(inner * sin).toFixed(2)}`,
        `A ${inner} ${inner} 0 ${largeArc} 0 ${inner} 0`,
        "Z",
    ].join(" ");
};

/** Interior angle at `vertex`, plus the local rotation that puts the sector inside the triangle. */
const cornerGeometry = (vertex: Point, first: Point, second: Point) => {
    const angleToFirst = Math.atan2(first.y - vertex.y, first.x - vertex.x);
    const angleToSecond = Math.atan2(second.y - vertex.y, second.x - vertex.x);
    let sweep = angleToSecond - angleToFirst;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep <= -Math.PI) sweep += 2 * Math.PI;
    return {
        theta: Math.abs(sweep),
        startDegrees: toDegrees(sweep > 0 ? angleToFirst : angleToFirst + sweep),
    };
};

function TriangleCornerTearDrawing() {
    const setVar = useSetVar();
    const apexX = useVar<number>("triangleApexX", 280);
    const apexY = useVar<number>("triangleApexY", 118);
    const tearTopRaw = useVar<number>("cornerTearTop", 0);
    const tearLeftRaw = useVar<number>("cornerTearLeft", 0);
    const tearRightRaw = useVar<number>("cornerTearRight", 0);
    const highlight = useVar<string>("triangleCornerHighlight", "");

    const svgRef = useRef<SVGSVGElement>(null);
    const orderRef = useRef<string[]>([]);
    const dragRef = useRef<{ key: string; startY: number; startValue: number; travel: number } | null>(null);
    const [apexDragging, setApexDragging] = useState(false);
    const [apexHovered, setApexHovered] = useState(false);

    const tearTop = useSpring(tearTopRaw, { stiffness: 420, damping: 34 });
    const tearLeft = useSpring(tearLeftRaw, { stiffness: 420, damping: 34 });
    const tearRight = useSpring(tearRightRaw, { stiffness: 420, damping: 34 });
    const apexScale = useSpring(apexDragging || apexHovered || highlight === "apex" ? 1.3 : 1, {
        stiffness: 400,
        damping: 26,
    });

    const apex: Point = { x: apexX, y: apexY };

    const topCorner = cornerGeometry(apex, LEFT_CORNER, RIGHT_CORNER);
    const leftCorner = cornerGeometry(LEFT_CORNER, RIGHT_CORNER, apex);
    const rightCorner = cornerGeometry(RIGHT_CORNER, apex, LEFT_CORNER);

    // Whole degrees that always read as a true 180 total.
    const leftDegrees = Math.round(toDegrees(leftCorner.theta));
    const rightDegrees = Math.round(toDegrees(rightCorner.theta));
    const topDegrees = 180 - leftDegrees - rightDegrees;

    const wedges = [
        { key: "cornerTearTop", vertex: apex, geometry: topCorner, value: tearTop, color: TEAL, label: topDegrees },
        { key: "cornerTearLeft", vertex: LEFT_CORNER, geometry: leftCorner, value: tearLeft, color: INDIGO, label: leftDegrees },
        { key: "cornerTearRight", vertex: RIGHT_CORNER, geometry: rightCorner, value: tearRight, color: VIOLET, label: rightDegrees },
    ];

    // Placed pieces pack along the line in the order the student moved them.
    const slotStart: Record<string, number> = {};
    let filled = 0;
    for (const key of orderRef.current) {
        const wedge = wedges.find((item) => item.key === key);
        if (!wedge) continue;
        slotStart[key] = 180 + filled;
        filled += toDegrees(wedge.geometry.theta) * wedge.value;
    }
    for (const wedge of wedges) {
        if (slotStart[wedge.key] === undefined) slotStart[wedge.key] = 180 + filled;
    }

    const allPlaced = tearTopRaw > 0.99 && tearLeftRaw > 0.99 && tearRightRaw > 0.99;
    const apexActive = highlight === "apex";
    const recede = apexActive ? 0.35 : 1;
    const ease = { transition: "opacity 150ms ease-out" };

    const toSvgPoint = (clientX: number, clientY: number): Point => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: ((clientX - rect.left) / rect.width) * VIEW_W,
            y: ((clientY - rect.top) / rect.height) * VIEW_H,
        };
    };

    const beginWedgeDrag = (
        event: React.PointerEvent<SVGPathElement>,
        key: string,
        vertex: Point,
        current: number,
    ) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        if (!orderRef.current.includes(key)) orderRef.current.push(key);
        dragRef.current = {
            key,
            startY: toSvgPoint(event.clientX, event.clientY).y,
            startValue: current,
            travel: Math.max(48, LINE_ORIGIN.y - vertex.y),
        };
        setVar("triangleTearExplored", true);
    };

    const moveWedgeDrag = (event: React.PointerEvent<SVGPathElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        const point = toSvgPoint(event.clientX, event.clientY);
        setVar(drag.key, clamp(drag.startValue + (point.y - drag.startY) / drag.travel, 0, 1));
    };

    const endWedgeDrag = () => {
        const drag = dragRef.current;
        if (!drag) return;
        const current = drag.key === "cornerTearTop" ? tearTopRaw : drag.key === "cornerTearLeft" ? tearLeftRaw : tearRightRaw;
        setVar(drag.key, current > 0.5 ? 1 : 0);
        dragRef.current = null;
    };

    const moveApex = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!apexDragging) return;
        const point = toSvgPoint(event.clientX, event.clientY);
        setVar("triangleApexX", Math.round(clamp(point.x, APEX_X_MIN, APEX_X_MAX)));
        setVar("triangleApexY", Math.round(clamp(point.y, APEX_Y_MIN, APEX_Y_MAX)));
    };

    return (
        <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block w-full">
            <defs>
                <filter id="corner-tear-handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Triangle outline and the straight line the pieces land on */}
            <g opacity={recede} style={ease}>
                <polygon
                    points={`${apex.x},${apex.y} ${LEFT_CORNER.x},${LEFT_CORNER.y} ${RIGHT_CORNER.x},${RIGHT_CORNER.y}`}
                    fill="#F8FAFC"
                    stroke={STRUCTURE}
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
                <line
                    x1={120}
                    y1={LINE_Y}
                    x2={440}
                    y2={LINE_Y}
                    stroke={allPlaced ? INK : STRUCTURE}
                    strokeWidth={allPlaced ? 3 : 1.5}
                    strokeLinecap="round"
                    style={{ transition: "stroke-width 150ms ease-out" }}
                />
            </g>

            {/* The three corner pieces */}
            <g opacity={recede} style={ease}>
                {wedges.map((wedge) => {
                    const t = wedge.value;
                    const cx = wedge.vertex.x + (LINE_ORIGIN.x - wedge.vertex.x) * t;
                    const cy = wedge.vertex.y + (LINE_ORIGIN.y - wedge.vertex.y) * t;
                    const rotation =
                        wedge.geometry.startDegrees +
                        shortestTurn(slotStart[wedge.key] - wedge.geometry.startDegrees) * t;
                    const scale = 1 + (SLOT_SCALE - 1) * t;
                    const transform = `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${rotation.toFixed(2)}) scale(${scale.toFixed(3)})`;
                    const labelRadius = WEDGE_R * scale * 0.62;
                    const labelAngle = toRadians(rotation + toDegrees(wedge.geometry.theta) / 2);
                    const raw = wedge.key === "cornerTearTop" ? tearTopRaw : wedge.key === "cornerTearLeft" ? tearLeftRaw : tearRightRaw;

                    return (
                        <g key={wedge.key}>
                            <path
                                d={sectorPath(wedge.geometry.theta, WEDGE_R)}
                                transform={transform}
                                fill={wedge.color}
                                fillOpacity={0.55}
                                stroke={wedge.color}
                                strokeWidth={2.5 / scale}
                                strokeLinejoin="round"
                            />
                            <text
                                x={cx + labelRadius * Math.cos(labelAngle)}
                                y={cy + labelRadius * Math.sin(labelAngle)}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="12"
                                fill={INK}
                                opacity={clamp(1 - t * 2.2, 0, 1)}
                                style={{ fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}
                            >
                                {`${wedge.label}°`}
                            </text>
                            <path
                                d={annulusPath(wedge.geometry.theta, 18, 46)}
                                transform={transform}
                                fill="transparent"
                                style={{ cursor: "grab", touchAction: "none" }}
                                onPointerDown={(event) => beginWedgeDrag(event, wedge.key, wedge.vertex, raw)}
                                onPointerMove={moveWedgeDrag}
                                onPointerUp={endWedgeDrag}
                                onPointerCancel={endWedgeDrag}
                            />
                        </g>
                    );
                })}
            </g>

            {/* Draggable top corner of the triangle */}
            {apexActive && (
                <circle cx={apex.x} cy={apex.y} r={22} fill={TEAL} opacity={0.28} />
            )}
            <circle
                cx={apex.x}
                cy={apex.y}
                r={11 * apexScale}
                fill={TEAL}
                stroke="#FFFFFF"
                strokeWidth="2"
                filter="url(#corner-tear-handle-shadow)"
            />
            <circle
                cx={apex.x}
                cy={apex.y}
                r={20}
                fill="transparent"
                style={{ cursor: apexDragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setApexDragging(true);
                }}
                onPointerMove={moveApex}
                onPointerUp={() => setApexDragging(false)}
                onPointerCancel={() => setApexDragging(false)}
                onPointerEnter={() => {
                    setApexHovered(true);
                    setVar("triangleCornerHighlight", "apex");
                }}
                onPointerLeave={() => {
                    setApexHovered(false);
                    setVar("triangleCornerHighlight", "");
                }}
            />

            {/* Live total under the line */}
            <g opacity={recede} style={ease}>
            <text
                x={LINE_ORIGIN.x}
                y={356}
                textAnchor="middle"
                fontSize="13"
                fill={INK}
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                <tspan fill={TEAL}>{`${topDegrees}°`}</tspan>
                <tspan>{" + "}</tspan>
                <tspan fill={INDIGO}>{`${leftDegrees}°`}</tspan>
                <tspan>{" + "}</tspan>
                <tspan fill={VIOLET}>{`${rightDegrees}°`}</tspan>
                <tspan fontWeight={allPlaced ? 700 : 400}>{" = 180°"}</tspan>
            </text>
            </g>
        </svg>
    );
}

function TriangleCornerTearFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="triangle-corner-tear"
            caption="Drag each shaded corner down onto the line, and drag the teal top point to reshape the triangle at any time."
            onReset={() => {
                setVar("triangleApexX", 280);
                setVar("triangleApexY", 118);
                setVar("cornerTearTop", 0);
                setVar("cornerTearLeft", 0);
                setVar("cornerTearRight", 0);
            }}
        >
            <TriangleCornerTearDrawing />
            <InteractionHintSequence
                hintKey="triangle-corner-tear-drag"
                steps={[
                    {
                        gesture: "drag-vertical",
                        label: "Drag the teal corner down to the line",
                        position: { x: "50%", y: "31%" },
                        dragPath: { type: "line", startOffset: { x: 0, y: -14 }, endOffset: { x: 0, y: 34 } },
                    },
                ]}
            />
        </Figure>
    );
}

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
                has any: a triangle. Each of its three shaded corners tears off and slides down
                onto the grey line beneath it. Bring all three down, then pull the{" "}
                <InlineLinkedHighlight
                    id="highlight-triangle-apex"
                    varName="triangleCornerHighlight"
                    highlightId="apex"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('triangleCornerHighlight'))}
                >
                    teal top point
                </InlineLinkedHighlight>
                {" "}around and watch what the pieces do.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-triangle-sum-visual" maxWidth="xl">
        <Block id="triangle-sum-visual" padding="sm" hasVisualization>
            <TriangleCornerTearFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-triangle-sum-insight" maxWidth="xl">
        <Block id="triangle-sum-insight" padding="sm">
            <EditableParagraph id="para-triangle-sum-insight" blockId="triangle-sum-insight">
                However you reshape it, the{" "}
                <InlineSpotColor varName="cornerTearTop" {...spotColorPropsFromDefinition(getVariableInfo('cornerTearTop'))}>
                    teal
                </InlineSpotColor>
                ,{" "}
                <InlineSpotColor varName="cornerTearLeft" {...spotColorPropsFromDefinition(getVariableInfo('cornerTearLeft'))}>
                    indigo
                </InlineSpotColor>
                {" "}and{" "}
                <InlineSpotColor varName="cornerTearRight" {...spotColorPropsFromDefinition(getVariableInfo('cornerTearRight'))}>
                    violet
                </InlineSpotColor>
                {" "}pieces fill the line exactly, with no gap and no overlap. A straight line is
                180 degrees, so the three angles of any triangle must total 180. That one stubborn
                fact is the engine behind everything else in this lesson.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-triangle-sum-third-angle" maxWidth="xl">
        <Block id="triangle-sum-third-angle" padding="sm">
            <EditableParagraph id="para-triangle-sum-third-angle" blockId="triangle-sum-third-angle">
                <RevealOnInteraction varName="triangleTearExplored">
                    A triangle has corners of 35 degrees and 65 degrees, so its third corner has
                    to be{" "}
                    <InlineFeedback
                        varName="answerTriangleThirdAngle"
                        correctValue={["80", "80°", "80 degrees"]}
                        position="terminal"
                        successMessage="— exactly, because 35 and 65 use up 100 of the 180, leaving 80 for the last corner"
                        failureMessage="— not quite."
                        hint="The three corners share 180 degrees between them, so take the two you know away from 180"
                        visualizationHint={{
                            blockId: "triangle-sum-visual",
                            hintKey: "feedback-triangle-corner-tear",
                            label: "Discover it yourself",
                            resetVars: { cornerTearTop: 0, cornerTearLeft: 0, cornerTearRight: 0 },
                            steps: [
                                {
                                    gesture: "drag-vertical",
                                    label: "Drag the indigo corner down to the line",
                                    position: { x: "27%", y: "66%" },
                                    completionVar: "cornerTearLeft",
                                    completionValue: 1,
                                    completionTolerance: 0.25,
                                },
                                {
                                    gesture: "drag-vertical",
                                    label: "Bring the violet corner down beside it",
                                    position: { x: "77%", y: "66%" },
                                    completionVar: "cornerTearRight",
                                    completionValue: 1,
                                    completionTolerance: 0.25,
                                },
                                {
                                    gesture: "drag-vertical",
                                    label: "Now the teal corner — it fills exactly the gap that is left",
                                    position: { x: "50%", y: "31%" },
                                    completionVar: "cornerTearTop",
                                    completionValue: 1,
                                    completionTolerance: 0.25,
                                },
                            ],
                        }}
                    >
                        <InlineClozeInput
                            varName="answerTriangleThirdAngle"
                            correctAnswer={["80", "80°", "80 degrees"]}
                            {...clozePropsFromDefinition(getVariableInfo('answerTriangleThirdAngle'))}
                        />
                    </InlineFeedback>
                    {" "}degrees.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-triangle-sum-stretch" maxWidth="xl">
        <Block id="triangle-sum-stretch" padding="sm">
            <EditableParagraph id="para-triangle-sum-stretch" blockId="triangle-sum-stretch">
                Stretch a triangle until it is so long and thin it almost looks flat, and its
                three angles{" "}
                <InlineFeedback
                    varName="answerTriangleStretch"
                    correctValue="still total 180 degrees"
                    position="terminal"
                    successMessage="— right, the corners trade sizes with each other but the total never moves"
                    failureMessage="— have another look."
                    hint="Try dragging the top point far out to one side and read the running total"
                    reviewBlockId="triangle-sum-visual"
                    reviewLabel="Back to the triangle"
                >
                    <InlineClozeChoice
                        varName="answerTriangleStretch"
                        correctAnswer="still total 180 degrees"
                        options={["still total 180 degrees", "total more than 180 degrees", "total less than 180 degrees"]}
                        {...choicePropsFromDefinition(getVariableInfo('answerTriangleStretch'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
