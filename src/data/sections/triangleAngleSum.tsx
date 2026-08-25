import { useEffect, useRef, useState, type ReactElement } from "react";
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
 * Corner-tear figure. The triangle is defined by its two base angles,
 * so it can be reshaped by dragging the top point OR by typing corner
 * sizes; the drawing is scaled to fit whatever shape those angles make.
 * ------------------------------------------------------------------ */

const VIEW_W = 560;
const VIEW_H = 380;
const BASE_Y = 250;
const LINE_Y = 330;
const LINE_ORIGIN = { x: 280, y: LINE_Y };
const MAX_WIDTH = 380;
const MAX_HEIGHT = 172;

const MIN_ANGLE = 15;
const MAX_ANGLE = 150;
const MAX_BASE_PAIR = 165; // leaves at least 15° for the top corner

const TEAL = "#62D0AD";
const INDIGO = "#8E90F5";
const VIOLET = "#AC8BF9";
const INK = "#334155";
const STRUCTURE = "#64748B";

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

/** Interior angle at `vertex`, plus the rotation that puts the sector inside the triangle. */
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

/** Corner points for a triangle with the given base angles, scaled to fit the frame. */
const layoutTriangle = (leftAngle: number, rightAngle: number) => {
    const left = toRadians(leftAngle);
    const right = toRadians(rightAngle);
    const opposite = Math.sin(left + right) || 0.0001;
    const apexDistance = Math.sin(right) / opposite;
    const apexUnit = { x: apexDistance * Math.cos(left), y: -apexDistance * Math.sin(left) };
    const minX = Math.min(0, apexUnit.x);
    const maxX = Math.max(1, apexUnit.x);
    const scale = Math.min(MAX_WIDTH / (maxX - minX), MAX_HEIGHT / Math.abs(apexUnit.y));
    const leftPoint = { x: LINE_ORIGIN.x - scale * ((minX + maxX) / 2), y: BASE_Y };
    return {
        scale,
        left: leftPoint,
        right: { x: leftPoint.x + scale, y: BASE_Y },
        apex: { x: leftPoint.x + scale * apexUnit.x, y: BASE_Y + scale * apexUnit.y },
    };
};

function AngleField({ varName, label, color, readOnlyValue }: {
    varName: string;
    label: string;
    color: string;
    readOnlyValue?: number;
}) {
    const setVar = useSetVar();
    const stored = useVar<number>(varName, 60);
    const value = readOnlyValue ?? stored;
    const [text, setText] = useState(String(value));

    useEffect(() => setText(String(value)), [value]);

    const commit = () => {
        const entered = Number(text);
        if (!Number.isFinite(entered)) {
            setText(String(value));
            return;
        }
        const next = clamp(Math.round(entered), MIN_ANGLE, MAX_ANGLE);
        setVar(varName, next);
        // The other base corner gives way if the two would leave no room on top.
        const partner = varName === "triangleAngleLeft" ? "triangleAngleRight" : "triangleAngleLeft";
        const partnerValue = useVariableValue(partner);
        if (next + partnerValue > MAX_BASE_PAIR) setVar(partner, MAX_BASE_PAIR - next);
    };

    return (
        <label className="flex items-center gap-2 text-[12px] text-[#64748B]">
            <span>{label}</span>
            <input
                type="number"
                inputMode="numeric"
                value={text}
                readOnly={readOnlyValue !== undefined}
                onChange={(event) => setText(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        commit();
                        event.currentTarget.blur();
                    }
                }}
                className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-[13px] focus:outline-none focus:ring-2 focus:ring-slate-300 read-only:text-[#64748B]"
                style={{ color, fontVariantNumeric: "tabular-nums" }}
            />
            <span>degrees</span>
        </label>
    );
}

/** Reads a value straight from the store outside of render order. */
function useVariableValue(name: string) {
    return useVar<number>(name, 60);
}

function TriangleCornerTearDrawing() {
    const setVar = useSetVar();
    const leftAngle = useVar<number>("triangleAngleLeft", 55);
    const rightAngle = useVar<number>("triangleAngleRight", 65);
    const tearTopRaw = useVar<number>("cornerTearTop", 0);
    const tearLeftRaw = useVar<number>("cornerTearLeft", 0);
    const tearRightRaw = useVar<number>("cornerTearRight", 0);
    const highlight = useVar<string>("triangleCornerHighlight", "");

    const svgRef = useRef<SVGSVGElement>(null);
    const orderRef = useRef<string[]>([]);
    const dragRef = useRef<{ key: string; startY: number; startValue: number; travel: number } | null>(null);
    const frozenRef = useRef<ReturnType<typeof layoutTriangle> | null>(null);
    const [apexDragging, setApexDragging] = useState(false);
    const [apexHovered, setApexHovered] = useState(false);

    const shownLeft = useSpring(leftAngle, { stiffness: 300, damping: 28 });
    const shownRight = useSpring(rightAngle, { stiffness: 300, damping: 28 });
    const tearTop = useSpring(tearTopRaw, { stiffness: 420, damping: 34 });
    const tearLeft = useSpring(tearLeftRaw, { stiffness: 420, damping: 34 });
    const tearRight = useSpring(tearRightRaw, { stiffness: 420, damping: 34 });
    const apexScale = useSpring(apexDragging || apexHovered || highlight === "apex" ? 1.3 : 1, {
        stiffness: 400,
        damping: 26,
    });

    const layout = apexDragging && frozenRef.current
        ? { ...frozenRef.current, ...layoutFrozen(frozenRef.current, shownLeft, shownRight) }
        : layoutTriangle(shownLeft, shownRight);

    const wedgeRadius = clamp(layout.scale * 0.11, 15, 34);
    const slotScale = 46 / wedgeRadius;

    const topCorner = cornerGeometry(layout.apex, layout.left, layout.right);
    const leftCorner = cornerGeometry(layout.left, layout.right, layout.apex);
    const rightCorner = cornerGeometry(layout.right, layout.apex, layout.left);

    const leftDegrees = Math.round(leftAngle);
    const rightDegrees = Math.round(rightAngle);
    const topDegrees = 180 - leftDegrees - rightDegrees;

    const wedges = [
        { key: "cornerTearTop", vertex: layout.apex, geometry: topCorner, value: tearTop, color: TEAL, label: topDegrees },
        { key: "cornerTearLeft", vertex: layout.left, geometry: leftCorner, value: tearLeft, color: INDIGO, label: leftDegrees },
        { key: "cornerTearRight", vertex: layout.right, geometry: rightCorner, value: tearRight, color: VIOLET, label: rightDegrees },
    ];

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
        const frozen = frozenRef.current;
        if (!frozen) return;
        const point = toSvgPoint(event.clientX, event.clientY);
        const height = Math.max(6, BASE_Y - point.y);
        const nextLeft = clamp(
            Math.round(toDegrees(Math.atan2(height, point.x - frozen.left.x))),
            MIN_ANGLE,
            MAX_ANGLE,
        );
        const nextRight = clamp(
            Math.round(toDegrees(Math.atan2(height, frozen.right.x - point.x))),
            MIN_ANGLE,
            MAX_BASE_PAIR - nextLeft,
        );
        setVar("triangleAngleLeft", nextLeft);
        setVar("triangleAngleRight", nextRight);
    };

    return (
        <svg ref={svgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block w-full">
            <defs>
                <filter id="corner-tear-handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <g opacity={recede} style={ease}>
                <polygon
                    points={`${layout.apex.x},${layout.apex.y} ${layout.left.x},${layout.left.y} ${layout.right.x},${layout.right.y}`}
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

            <g opacity={recede} style={ease}>
                {wedges.map((wedge) => {
                    const t = wedge.value;
                    const cx = wedge.vertex.x + (LINE_ORIGIN.x - wedge.vertex.x) * t;
                    const cy = wedge.vertex.y + (LINE_ORIGIN.y - wedge.vertex.y) * t;
                    const rotation =
                        wedge.geometry.startDegrees +
                        shortestTurn(slotStart[wedge.key] - wedge.geometry.startDegrees) * t;
                    const scale = 1 + (slotScale - 1) * t;
                    const transform = `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${rotation.toFixed(2)}) scale(${scale.toFixed(3)})`;
                    const labelRadius = wedgeRadius * scale * 0.62;
                    const labelAngle = toRadians(rotation + toDegrees(wedge.geometry.theta) / 2);
                    const raw = wedge.key === "cornerTearTop" ? tearTopRaw : wedge.key === "cornerTearLeft" ? tearLeftRaw : tearRightRaw;

                    return (
                        <g key={wedge.key}>
                            <path
                                d={sectorPath(wedge.geometry.theta, wedgeRadius)}
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
                                d={annulusPath(wedge.geometry.theta, wedgeRadius * 0.5, wedgeRadius + 12)}
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

            {apexActive && <circle cx={layout.apex.x} cy={layout.apex.y} r={22} fill={TEAL} opacity={0.28} />}
            <circle
                cx={layout.apex.x}
                cy={layout.apex.y}
                r={11 * apexScale}
                fill={TEAL}
                stroke="#FFFFFF"
                strokeWidth="2"
                filter="url(#corner-tear-handle-shadow)"
            />
            <circle
                cx={layout.apex.x}
                cy={layout.apex.y}
                r={20}
                fill="transparent"
                style={{ cursor: apexDragging ? "grabbing" : "grab", touchAction: "none" }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    frozenRef.current = layoutTriangle(leftAngle, rightAngle);
                    setApexDragging(true);
                }}
                onPointerMove={moveApex}
                onPointerUp={() => {
                    setApexDragging(false);
                    frozenRef.current = null;
                }}
                onPointerCancel={() => {
                    setApexDragging(false);
                    frozenRef.current = null;
                }}
                onPointerEnter={() => {
                    setApexHovered(true);
                    setVar("triangleCornerHighlight", "apex");
                }}
                onPointerLeave={() => {
                    setApexHovered(false);
                    setVar("triangleCornerHighlight", "");
                }}
            />

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

/** While the apex is being dragged the frame keeps the size it had, so the shape tracks the pointer. */
function layoutFrozen(frozen: ReturnType<typeof layoutTriangle>, leftAngle: number, rightAngle: number) {
    const left = toRadians(leftAngle);
    const right = toRadians(rightAngle);
    const opposite = Math.sin(left + right) || 0.0001;
    const apexDistance = (Math.sin(right) / opposite) * frozen.scale;
    return {
        apex: {
            x: frozen.left.x + apexDistance * Math.cos(left),
            y: BASE_Y - apexDistance * Math.sin(left),
        },
    };
}

function TriangleCornerTearFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="triangle-corner-tear"
            caption="Drag each shaded corner down onto the line. Reshape the triangle by dragging the teal top point, or by typing corner sizes below."
            onReset={() => {
                setVar("triangleAngleLeft", 55);
                setVar("triangleAngleRight", 65);
                setVar("cornerTearTop", 0);
                setVar("cornerTearLeft", 0);
                setVar("cornerTearRight", 0);
            }}
        >
            <TriangleCornerTearDrawing />
            <TriangleAngleControls />
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

function TriangleAngleControls() {
    const leftAngle = useVar<number>("triangleAngleLeft", 55);
    const rightAngle = useVar<number>("triangleAngleRight", 65);
    return (
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 pb-5">
            <AngleField varName="triangleAngleLeft" label="Left corner" color={INDIGO} />
            <AngleField varName="triangleAngleRight" label="Right corner" color={VIOLET} />
            <AngleField varName="triangleAngleTopReadout" label="Top corner" color={TEAL}
                readOnlyValue={180 - Math.round(leftAngle) - Math.round(rightAngle)} />
        </div>
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
            <EditableParagraph id="para-triangle-sum-insight" blockId="triangle-sum-insight">However you reshape it, the <InlineSpotColor varName={"cornerTearTop"} color={"#62D0AD"} id={"spotColor-1787651960312-t5vuf"}>teal</InlineSpotColor>, <InlineSpotColor varName={"cornerTearLeft"} color={"#8E90F5"} id={"spotColor-1787651960312-bpzja"}>indigo</InlineSpotColor> and <InlineSpotColor varName={"cornerTearRight"} color={"#AC8BF9"} id={"spotColor-1787651960312-8dyzg"}>violet</InlineSpotColor> pieces fill the line exactly, with no gap and no overlap. A straight line is 180 degrees, so the three angles of any triangle must total 180.</EditableParagraph>
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
