import ts from 'typescript';
import { parseMember } from './members';

export function parseType(t: ts.TypeNode | undefined): Type<ts.TypeNode> | undefined {
  if (!t) {
    return undefined;
  }

  switch (t.kind) {
    case ts.SyntaxKind.TypeReference:
      return parseTypeReference(t as ts.TypeReferenceNode);

    case ts.SyntaxKind.UnionType:
      return new UnionType(t as ts.UnionTypeNode);

    case ts.SyntaxKind.ArrayType:
      return new ArrayType(t as ts.ArrayTypeNode);

    case ts.SyntaxKind.LiteralType:
      return new LiteralType(t as ts.LiteralTypeNode);

    case ts.SyntaxKind.IntersectionType:
      return new IntersectionType(t as ts.IntersectionTypeNode);

    case ts.SyntaxKind.TypeLiteral:
      return new TypeLiteral(t as ts.TypeLiteralNode);

    case ts.SyntaxKind.FunctionType:
      return new FunctionType(t as ts.FunctionTypeNode);

    case ts.SyntaxKind.TupleType:
      return new TupleType(t as ts.TupleTypeNode);

    case ts.SyntaxKind.ParenthesizedType:
      return parseType((t as ts.ParenthesizedTypeNode).type);

    case ts.SyntaxKind.ConstructorType:
      return new FunctionType(t as ts.ConstructorTypeNode);

    case ts.SyntaxKind.TypeQuery:
      return new TypeQuery(t as ts.TypeQueryNode);

    case ts.SyntaxKind.ExpressionWithTypeArguments:
      return new ExpressionWithTypeArguments(t as ts.ExpressionWithTypeArguments);

    case ts.SyntaxKind.StringKeyword:
    case ts.SyntaxKind.NumberKeyword:
    case ts.SyntaxKind.BooleanKeyword:
    case ts.SyntaxKind.UnknownKeyword:
    case ts.SyntaxKind.AnyKeyword:
    case ts.SyntaxKind.VoidKeyword:
    case ts.SyntaxKind.NeverKeyword:
    case ts.SyntaxKind.ObjectKeyword:
    case ts.SyntaxKind.NullKeyword:
    case ts.SyntaxKind.UndefinedKeyword:
      return new Primitive(t);
  }

  console.error('unknown type kind: ' + ts.SyntaxKind[t.kind]);

  return new UnknownType(t);
}

export function parseParameter(p: ts.ParameterDeclaration) {
  return {
    name: p.name.getText(),
    optional: p.questionToken !== undefined,
    type: parseType(p.type),
  };
}

export function parseTypeParameter(p: ts.TypeParameterDeclaration) {
  return {
    name: p.name.getText(),
    constraint: parseType(ts.getEffectiveConstraintOfTypeParameter(p)),
  };
}

type TypeKind =
  'primitive'
  | 'array'
  | 'ref'
  | 'generic'
  | 'union'
  | 'literal'
  | 'typeof'
  | 'function'
  | 'tuple'
  | 'intersection'
  | '<unknown>';

abstract class Type<T extends ts.TypeNode> {
  abstract kind: TypeKind;

  constructor(protected node: T) { }

  abstract json(): any;

  toJSON() {
    return { [this.kind]: this.json() };
  }
}

class UnknownType extends Type<ts.TypeNode> {
  kind: TypeKind = '<unknown>';

  json() {
    return undefined;
  }
}

function parseTypeReference(t: ts.TypeReferenceNode) {
  if ((t.typeArguments ?? []).length > 0) {
    return new GenericTypeReference(t);
  } else {
    return new TypeReference(t);
  }
}

class TypeReference extends Type<ts.TypeReferenceNode> {
  kind: TypeKind = 'ref';

  json() {
    return this.node.typeName.getText();
  }
}

class GenericTypeReference extends Type<ts.TypeReferenceNode> {
  kind: TypeKind = 'generic';

  json() {
    return {
      type: this.node.typeName.getText(),
      generic: this.node.typeArguments?.map(parseType),
    };
  }
}

class UnionType extends Type<ts.UnionTypeNode> {
  kind: TypeKind = 'union';

  json() {
    return this.node.types.map(parseType);
  }
}

class Primitive extends Type<ts.TypeNode> {
  kind: TypeKind = 'primitive';

  json() {
    return ts.SyntaxKind[this.node.kind].replace(/Keyword$/, '').toLocaleLowerCase();
  }
}

class TypeQuery extends Type<ts.TypeQueryNode> {
  kind: TypeKind = 'typeof';

  json() {
    return {
      typeArguments: this.node.typeArguments?.map(parseType),
      exprName: this.node.exprName.getText(),
    };
  }
}

class FunctionType extends Type<ts.FunctionTypeNode | ts.ConstructorTypeNode> {
  kind: TypeKind = 'function';

  json() {
    return {
      parameters: this.node.parameters.map(parseParameter),
      typeParameters: this.node.typeParameters?.map(parseTypeParameter),
      return: parseType(this.node.type),
    };
  }
}

class TupleType extends Type<ts.TupleTypeNode> {
  kind: TypeKind = 'tuple';

  json() {
    return this.node.elements.map(parseType);
  }
}

class TypeLiteral extends Type<ts.TypeLiteralNode> {
  kind: TypeKind = 'literal';

  json() {
    return {
      members: this.node.members.map(parseMember),
    };
  }
}

class IntersectionType extends Type<ts.IntersectionTypeNode> {
  kind: TypeKind = 'intersection';

  json() {
    return this.node.types.map(parseType);
  }
}

class LiteralType extends Type<ts.LiteralTypeNode> {
  kind: TypeKind = 'literal';

  json() {
    return this.node.literal.getText();
  }
}

class ArrayType extends Type<ts.ArrayTypeNode> {
  kind: TypeKind = 'array';

  json() {
    return parseType(this.node.elementType);
  }
}

class ExpressionWithTypeArguments extends Type<ts.ExpressionWithTypeArguments> {
  kind: TypeKind = 'ref';

  json() {
    return {
      expr: this.node.expression.getText(),
      typeArguments: this.node.typeArguments?.map(parseType),
    };
  }
}
