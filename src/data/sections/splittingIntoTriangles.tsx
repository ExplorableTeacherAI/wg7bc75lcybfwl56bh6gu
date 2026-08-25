import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineToggle,
    InteractionHintSequence,
    RevealOnInteraction,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useSpring } from "@/lib/motion";
import {
    getVariableInfo,
    clozePropsFromDefinition,
    linkedHighlightPropsFromDefinition,
    togglePropsFromDefinition,
} from "../variables";

/* ------------------------------------------------------------------ *
 * One cut at a time. Every cut runs from the same starting corner,
 * and each one slices a fresh triangle off the hexagon.
 * ------------------------------------------------------------------ */

const VIEW = 400;
const HEX_CENTER = { x: 200, y: 180 };
const HEX_RADIUS = 118;
const CUT_TARGETS = [2, 3, 4];

const TEAL = "#62D0AD";
const INK = "#334155";
const STRUCTURE = "#64748B";
const PAPER = "#F1F5F9";

type Point = { x: number; y: number };

const hexVertex = (index: number): Point => {
    const angle = ((90 - index * 60) * Math.PI) / 180;
    return {
        x: HEX_CENTER.x + HEX_RADIUS * Math.cos(angle),
        y: HEX_CENTER.y - HEX_RADIUS * Math.sin(angle),
    };
};

const HEX_VERTICES = Array.from({ length: 6 }, (_, index) => hexVertex(index));
const START = HEX_VERTICES[0];

const pointsAttribute = (points: Point[]) =>
    points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function HexagonCutsDrawing() {
    const setVar = useSetVar();
    const cutsText = useVar<string>("hexagonCuts", "");
    const highlight = useVar<string>("hexagonViewHighlight", "");
    const [pointer, setPointer] = useState<Point | null>(null);
    const [hovered, setHovered] = useState(false);

    const cuts = useMemo(
        () => cutsText.split(",").map((value) => Number(value)).filter((value) => CUT_TARGETS.includes(value)),
        [cutsText],
    );
    const newestCut = cuts.length > 0 ? cuts[cuts.length - 1] : null;

    const growth = useSpring(cuts.length, { stiffness: 190, damping: 22 });
    const newestGrowth = clamp(growth - (cuts.length - 1), 0, 1);
    const startScale = useSpring(pointer || hovered || highlight === "start" ? 1.3 : 1, {
        stiffness: 400,
        damping: 26,
    });

    // Cuts from one corner turn the shape into strips between neighbouring cuts.
    const boundaries = [1, ...[...cuts].sort((a, b) => a - b), 5];
    const regions = boundaries.slice(0, -1).map((from, index) => {
        const to = boundaries[index + 1];
        const corners = [START, ...Array.from({ length: to - from + 1 }, (_, step) => HEX_VERTICES[from + step])];
        return { from, to, corners, isTriangle: to - from === 1 };
    });

    const triangleCount = regions.filter((region) => region.isTriangle).length;
    const complete = cuts.length === CUT_TARGETS.length;

    useEffect(() => {
        setVar("hexagonCutCount", cuts.length);
        setVar("hexagonTriangleCount", triangleCount);
    }, [setVar, cuts.length, triangleCount]);

    const addCut = (target: number) => {
        if (cuts.includes(target)) return;
        setVar("hexagonCuts", [...cuts, target].join(","));
        setVar("hexagonExplored", true);
    };

    const svgPoint = (event: React.PointerEvent<SVGElement>): Point => {
        const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
            ?? (event.currentTarget as SVGSVGElement).getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * VIEW,
            y: ((event.clientY - rect.top) / rect.height) * VIEW,
        };
    };

    const releaseDrag = (event: React.PointerEvent<SVGCircleElement>) => {
        const point = svgPoint(event);
        const target = CUT_TARGETS.filter((index) => !cuts.includes(index))
            .find((index) => distance(point, HEX_VERTICES[index]) < 34);
        if (target !== undefined) addCut(target);
        setPointer(null);
    };

    const startActive = highlight === "start";
    const cutsActive = highlight === "cuts";
    const dim = (id: string) => (highlight && highlight !== id ? 0.35 : 1);
    const ease = { transition: "opacity 150ms ease-out" };

    return (
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="block w-full">
            <defs>
                <filter id="hexagon-cut-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* The pieces the cuts have made so far */}
            <g opacity={dim("pieces")} style={ease}>
                {regions.map((region, index) => {
                    const touchesNewest = newestCut !== null && (region.from === newestCut || region.to === newestCut);
                    return (
                        <polygon
                            key={`region-${region.from}-${region.to}`}
                            points={pointsAttribute(region.corners)}
                            fill={region.isTriangle ? TEAL : PAPER}
                            fillOpacity={region.isTriangle ? (index % 2 === 0 ? 0.22 : 0.34) : 1}
                            opacity={touchesNewest ? newestGrowth : 1}
                        />
                    );
                })}
                <polygon
                    points={pointsAttribute(HEX_VERTICES)}
                    fill="none"
                    stroke={complete ? INK : STRUCTURE}
                    strokeWidth={complete ? 3 : 2}
                    strokeLinejoin="round"
                    style={{ transition: "stroke-width 150ms ease-out" }}
                />
            </g>

            {/* Each cut, drawn from the starting corner */}
            <g
                opacity={dim("cuts")}
                style={ease}
                onPointerEnter={() => setVar("hexagonViewHighlight", "cuts")}
                onPointerLeave={() => setVar("hexagonViewHighlight", "")}
            >
                {cuts.map((target) => {
                    const end = HEX_VERTICES[target];
                    const length = distance(START, end);
                    const drawn = target === newestCut ? newestGrowth : 1;
                    return (
                        <g key={`cut-${target}`}>
                            {cutsActive && (
                                <line x1={START.x} y1={START.y} x2={end.x} y2={end.y} stroke={TEAL}
                                    strokeWidth={9} opacity={0.28} strokeLinecap="round" />
                            )}
                            <line
                                x1={START.x}
                                y1={START.y}
                                x2={end.x}
                                y2={end.y}
                                stroke={TEAL}
                                strokeWidth={cutsActive ? 4 : 2.5}
                                strokeLinecap="round"
                                strokeDasharray={length}
                                strokeDashoffset={length * (1 - drawn)}
                                style={{ transition: "stroke-width 150ms ease-out" }}
                            />
                        </g>
                    );
                })}
            </g>

            {/* Corners still waiting to be cut to */}
            <g opacity={dim("targets")} style={ease}>
                {CUT_TARGETS.filter((index) => !cuts.includes(index)).map((index) => {
                    const corner = HEX_VERTICES[index];
                    const reachable = pointer !== null && distance(pointer, corner) < 34;
                    return (
                        <g key={`target-${index}`}>
                            <circle cx={corner.x} cy={corner.y} r={reachable ? 12 : 8} fill="#FFFFFF"
                                stroke={TEAL} strokeWidth={reachable ? 3 : 2} strokeDasharray={reachable ? undefined : "3 3"}
                                style={{ transition: "r 150ms ease-out" }} />
                            <circle cx={corner.x} cy={corner.y} r={20} fill="transparent"
                                style={{ cursor: "pointer", touchAction: "none" }}
                                onClick={() => addCut(index)} />
                        </g>
                    );
                })}
            </g>

            {/* The rubber band while a cut is being pulled across */}
            {pointer && (
                <line x1={START.x} y1={START.y} x2={pointer.x} y2={pointer.y} stroke={TEAL} strokeWidth={2.5}
                    strokeLinecap="round" strokeDasharray="6 6" opacity={0.8} />
            )}

            {/* The starting corner every cut runs from */}
            <g opacity={dim("start")} style={ease}>
                {startActive && <circle cx={START.x} cy={START.y} r={22} fill={TEAL} opacity={0.28} />}
                <circle cx={START.x} cy={START.y} r={11 * startScale} fill={TEAL} stroke="#FFFFFF" strokeWidth="2"
                    filter="url(#hexagon-cut-shadow)" />
                <circle
                    cx={START.x}
                    cy={START.y}
                    r={22}
                    fill="transparent"
                    style={{ cursor: pointer ? "grabbing" : "grab", touchAction: "none" }}
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setPointer(svgPoint(event));
                    }}
                    onPointerMove={(event) => {
                        if (pointer) setPointer(svgPoint(event));
                    }}
                    onPointerUp={releaseDrag}
                    onPointerCancel={() => setPointer(null)}
                    onPointerEnter={() => {
                        setHovered(true);
                        setVar("hexagonViewHighlight", "start");
                    }}
                    onPointerLeave={() => {
                        setHovered(false);
                        setVar("hexagonViewHighlight", "");
                    }}
                />
            </g>

            {/* Running count */}
            <g opacity={dim("count")} style={ease}>
                <text x={HEX_CENTER.x} y={344} textAnchor="middle" fontSize="13" fill={STRUCTURE}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    {`${cuts.length} cuts`}
                </text>
                <text x={HEX_CENTER.x} y={370} textAnchor="middle" fontSize="13" fill={INK}
                    fontWeight={complete ? 700 : 400} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {complete ? "4 triangles, nothing left over" : `${triangleCount} triangles so far`}
                </text>
            </g>
        </svg>
    );
}

function HexagonCutsFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="hexagon-cuts"
            caption="Drag from the teal corner across to a dotted corner to make a cut, one at a time. Each cut slices off one more triangle."
            onReset={() => {
                setVar("hexagonCuts", "");
                setVar("hexagonCutCount", 0);
                setVar("hexagonTriangleCount", 0);
            }}
        >
            <HexagonCutsDrawing />
            <InteractionHintSequence
                hintKey="hexagon-cuts-drag"
                steps={[
                    {
                        gesture: "drag",
                        label: "Drag from the teal corner to a dotted corner",
                        position: { x: "50%", y: "16%" },
                        dragPath: { type: "line", startOffset: { x: 0, y: 6 }, endOffset: { x: 42, y: 60 } },
                    },
                ]}
            />
        </Figure>
    );
}

/* ------------------------------------------------------------------ *
 * Shape quiz — the same rule tested from a hexagon up to a decagon.
 * ------------------------------------------------------------------ */

const SHAPE_QUIZ = [
    { name: "hexagon", sides: 6, varName: "answerQuizHexagon", answer: ["4", "four"] },
    { name: "heptagon", sides: 7, varName: "answerQuizHeptagon", answer: ["5", "five"] },
    { name: "octagon", sides: 8, varName: "answerQuizOctagon", answer: ["6", "six"] },
    { name: "nonagon", sides: 9, varName: "answerQuizNonagon", answer: ["7", "seven"] },
    { name: "decagon", sides: 10, varName: "answerQuizDecagon", answer: ["8", "eight"] },
];

function ShapeQuizQuestion() {
    const name = useVar<string>("quizShapeName", "hexagon");
    const shape = SHAPE_QUIZ.find((item) => item.name === name) ?? SHAPE_QUIZ[0];
    return (
        <>
            {` has ${shape.sides} sides, so fanned from one corner it splits into `}
            <InlineFeedback
                key={shape.name}
                varName={shape.varName}
                correctValue={shape.answer}
                position="terminal"
                successMessage={`— yes, ${shape.sides} sides give ${shape.answer[0]} triangles`}
                failureMessage="— not quite."
                hint="Count the sides, then take two away"
                reviewBlockId="splitting-visual"
                reviewLabel="Back to the hexagon"
            >
                <InlineClozeInput
                    varName={shape.varName}
                    correctAnswer={shape.answer}
                    {...clozePropsFromDefinition(getVariableInfo(shape.varName))}
                />
            </InlineFeedback>
            {" triangles."}
        </>
    );
}

function ShapeQuizScore() {
    const hexagon = useVar<string>("answerQuizHexagon", "");
    const heptagon = useVar<string>("answerQuizHeptagon", "");
    const octagon = useVar<string>("answerQuizOctagon", "");
    const nonagon = useVar<string>("answerQuizNonagon", "");
    const decagon = useVar<string>("answerQuizDecagon", "");

    const given = [hexagon, heptagon, octagon, nonagon, decagon];
    const solved = SHAPE_QUIZ.filter((shape, index) =>
        shape.answer.includes(given[index].trim().toLowerCase()),
    ).length;

    if (solved === 0) return null;
    if (solved === SHAPE_QUIZ.length) {
        return <span>{" All five shapes solved, and the rule held every time."}</span>;
    }
    return <span>{` Solved so far: ${solved} of 5.`}</span>;
}

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
                A six-sided tile looks nothing like a triangle, yet it is full of them. Drag
                across the hexagon to slice it, one cut at a time, and watch a fresh triangle
                sweep in with every cut. Notice that every{" "}
                <InlineLinkedHighlight
                    id="highlight-hexagon-start"
                    varName="hexagonViewHighlight"
                    highlightId="start"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('hexagonViewHighlight'))}
                >
                    cut starts from the same corner
                </InlineLinkedHighlight>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-visual" maxWidth="xl">
        <Block id="splitting-visual" padding="sm" hasVisualization>
            <HexagonCutsFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-insight" maxWidth="xl">
        <Block id="splitting-insight" padding="sm">
            <EditableParagraph id="para-splitting-insight" blockId="splitting-insight">
                Here is the slippery part: plenty of other triangles overlap inside a hexagon, and
                it is tempting to count them all. Only the pieces made by cuts from one corner
                count, because those cover the shape exactly once, with nothing doubled and nothing
                missed. Three cuts, four triangles.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-hexagon-count" maxWidth="xl">
        <Block id="splitting-hexagon-count" padding="sm">
            <EditableParagraph id="para-splitting-hexagon-count" blockId="splitting-hexagon-count">
                <RevealOnInteraction varName="hexagonExplored">
                    Cut from one corner until nothing is left over, a hexagon holds{" "}
                    <InlineFeedback
                        varName="answerHexagonTriangles"
                        correctValue={["4", "four"]}
                        position="terminal"
                        successMessage="— yes, four triangles and not one more"
                        failureMessage="— not quite."
                        hint="Keep cutting until no piece is left with more than three corners, then count the pieces"
                        visualizationHint={{
                            blockId: "splitting-visual",
                            hintKey: "feedback-hexagon-coverage",
                            label: "Discover it yourself",
                            resetVars: { hexagonCuts: "", hexagonCutCount: 0, hexagonTriangleCount: 0 },
                            steps: [
                                {
                                    gesture: "drag",
                                    label: "Drag from the teal corner to a dotted corner to make your first cut",
                                    position: { x: "50%", y: "16%" },
                                    completionVar: "hexagonCutCount",
                                    completionValue: 1,
                                    completionTolerance: 0.4,
                                },
                                {
                                    gesture: "drag",
                                    label: "Keep cutting until no piece is left over, then count the triangles",
                                    position: { x: "50%", y: "16%" },
                                    completionVar: "hexagonTriangleCount",
                                    completionValue: 4,
                                    completionTolerance: 0.4,
                                },
                            ],
                        }}
                    >
                        <InlineClozeInput
                            varName="answerHexagonTriangles"
                            correctAnswer={["4", "four"]}
                            {...clozePropsFromDefinition(getVariableInfo('answerHexagonTriangles'))}
                        />
                    </InlineFeedback>
                    {" "}triangles.
                </RevealOnInteraction>
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-splitting-shape-quiz" maxWidth="xl">
        <Block id="splitting-shape-quiz" padding="sm">
            <EditableParagraph id="para-splitting-shape-quiz" blockId="splitting-shape-quiz">
                The same rule reaches shapes far too big to draw here, from six sides all the way
                up to ten. The{" "}
                <InlineToggle
                    id="toggle-quiz-shape"
                    varName="quizShapeName"
                    options={["hexagon", "heptagon", "octagon", "nonagon", "decagon"]}
                    {...togglePropsFromDefinition(getVariableInfo('quizShapeName'))}
                />
                <ShapeQuizQuestion />
                <ShapeQuizScore />
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
