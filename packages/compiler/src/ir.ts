/**
 * @kylat/compiler - ir.ts
 * Representasi Intermediate Representation (IR) komponen Kylat sesuai spec/ir.md.
 */

import type { KylatType } from './types.js';

export interface PropDefinition {
  name: string;
  type: string;
  parsedType?: KylatType;
  isRequired: boolean;
  defaultValue?: string;
}

export interface StateDefinition {
  name: string;
  type: string;
  parsedType?: KylatType;
  initialValue: string;
}

export interface ComputedDefinition {
  name: string;
  returnType: string;
  parsedReturnType?: KylatType;
  body: string;
  bodyCode?: string[];
  bodyLocations?: Array<{ line: number; column: number }>;
  dependencies: string[];
}

export type ClientOperation =
  | { type: 'mutate_state'; target: string; operator: '+=' | '-=' | '='; operand: string }
  | { type: 'call_method'; method: string; args: string[] };

export interface ServerCallDefinition {
  contract: string;
  actionMethod: string;
  args: Array<{ name: string; valueExpr: string }>;
  isMutation: boolean;
}

export interface MethodDefinition {
  name: string;
  params: Array<{ name: string; type: string; parsedType?: KylatType }>;
  returnType: string;
  parsedReturnType?: KylatType;
  kind: 'client' | 'server' | 'computed' | 'onMount' | 'effect';
  isAction?: boolean;
  body: string;
  bodyCode?: string[];
  bodyLocations?: Array<{ line: number; column: number }>;
  dependencies?: string[];
  operations?: ClientOperation[];
  serverCall?: ServerCallDefinition;
}

export interface LifecycleDefinition {
  name: string;
  kind: 'onMount' | 'effect';
  bodyCode: string[];
  bodyLocations?: Array<{ line: number; column: number }>;
  dependencies: string[];
}

export interface ChildComponentDefinition {
  className: string;
  tag: string;
}

export interface ServerActionContract {
  contractName: string;
}

export type TemplateNodeType =
  | 'element'
  | 'text'
  | 'expression'
  | 'comment'
  | 'conditional'
  | 'foreach'
  | 'component';

export interface BaseTemplateNode {
  type: TemplateNodeType;
  line: number;
  column: number;
}

export interface ElementNode extends BaseTemplateNode {
  type: 'element';
  tag: string;
  attributes: Record<string, string>;
  bindings: Record<string, string>;
  events: Record<string, string>;
  children: TemplateNode[];
}

export interface TextNode extends BaseTemplateNode {
  type: 'text';
  content: string;
}

export interface ExpressionNode extends BaseTemplateNode {
  type: 'expression';
  expression: string;
}

export interface ConditionalNode extends BaseTemplateNode {
  type: 'conditional';
  condition: string;
  consequent: TemplateNode[];
  alternate?: TemplateNode[];
}

export interface ForEachNode extends BaseTemplateNode {
  type: 'foreach';
  collection: string;
  item: string;
  keyProperty: string;
  children: TemplateNode[];
}

export interface ComponentNode extends BaseTemplateNode {
  type: 'component';
  name: string;
  props: Record<string, string>;
  children: TemplateNode[];
}

export type TemplateNode =
  | ElementNode
  | TextNode
  | ExpressionNode
  | ConditionalNode
  | ForEachNode
  | ComponentNode;

export interface ComponentIR {
  name: string;
  namespace?: string;
  isFinal: boolean;
  props: PropDefinition[];
  state: StateDefinition[];
  computeds: ComputedDefinition[];
  methods: MethodDefinition[];
  lifecycle?: LifecycleDefinition[];
  serverUses: ServerActionContract[];
  childComponents: ChildComponentDefinition[];
  template?: TemplateNode[];
}
