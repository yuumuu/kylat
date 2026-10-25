/**
 * @kylat/compiler - ir.ts
 * Representasi Intermediate Representation (IR) komponen Kylat sesuai spec/ir.md.
 */

export interface PropDefinition {
  name: string;
  type: string;
  isRequired: boolean;
  defaultValue?: string;
}

export interface StateDefinition {
  name: string;
  type: string;
  initialValue: string;
}

export interface ComputedDefinition {
  name: string;
  returnType: string;
  body: string;
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
  params: Array<{ name: string; type: string }>;
  returnType: string;
  kind: 'client' | 'server';
  body: string;
  operations?: ClientOperation[];
  serverCall?: ServerCallDefinition;
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
  serverUses: ServerActionContract[];
  childComponents: ChildComponentDefinition[];
  template?: TemplateNode[];
}
