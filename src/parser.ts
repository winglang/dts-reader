import ts from 'typescript';

export class Parser {
  public checker: ts.TypeChecker;
  public sourceFile: ts.SourceFile;
  private filePath: string;

  private additionalDeclarations: Declaration<ts.Declaration>[] = [];

  constructor(filePath: string) {
    const program = ts.createProgram([filePath], {});
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`Could not find source file: ${filePath}`);
    }

    this.filePath = filePath;
    this.sourceFile = sourceFile;
    this.checker = checker;
  }

  parseSource(): Declaration<ts.Declaration>[] {
    const sourceFileSymbol = this.checker.getSymbolAtLocation(this.sourceFile);
    if (!sourceFileSymbol) {
      throw new Error(`Could not find source file symbol: ${this.filePath}`);
    }
    const exports = this.checker.getExportsOfModule(sourceFileSymbol);
    const types = exports.map(e => this.parseSymbol(e)).flat();
    const exportAssignment = this.tryFindExportAssignment();
    if (exportAssignment) {
      const decl = this.parseDeclaration(sourceFileSymbol, exportAssignment);
      if (decl) {
        types.push(decl);
      }
    }

    // causes serialization to happen
    JSON.stringify(types);

    console.log('Before');
    types.push(...this.additionalDeclarations);
    console.log('After');

    return types;
  }

  addType(typeNode: ts.TypeNode) {
    console.log('addType', typeNode.getText());
    const sym = this.checker.getTypeFromTypeNode(typeNode).getSymbol();
    if (!sym) {
      throw new Error(`Could not find symbol for type: ${typeNode.getText()}`);
    }

    this.additionalDeclarations.push(...this.parseSymbol(sym));
  }

  // look for an ExportAssignment node in the source file
  private tryFindExportAssignment() {
    let exportAssignment: ts.ExportAssignment | undefined;
    ts.forEachChild(this.sourceFile, (node) => {
      if (ts.isExportAssignment(node)) {
        exportAssignment = node;
      }
    });

    return exportAssignment;
  }


  tryFindSymbol(identifier: string): ts.Symbol | undefined {
    const lookup = (node: ts.Node): ts.Symbol | undefined => {
      if (ts.isIdentifier(node) && node.text === identifier) {
        const symbol = this.checker.getSymbolAtLocation(node);
        if (!symbol) {
          throw new Error(`Could not find symbol for identifier: ${identifier}`);
        }

        return symbol;
      }

      return ts.forEachChild(node, lookup);
    };

    return lookup(this.sourceFile);
  }

  tryFindType(identifier: string): ts.Type | undefined {
    const symbol = this.tryFindSymbol(identifier);
    if (!symbol) {
      return undefined;
    }

    return this.checker.getTypeOfSymbolAtLocation(symbol, this.sourceFile);
  }

  parseSymbol(symbol: ts.Symbol): Declaration<ts.Declaration>[] {
    const declarations = symbol.getDeclarations() ?? [];
    const result = new Array<Declaration<ts.Declaration>>();
    for (const decl of declarations) {
      const type = this.parseDeclaration(symbol, decl);
      if (type) {
        result.push(type);
      }
    }

    return result;
  }

  parseDeclaration(symbol: ts.Symbol, decl: ts.Declaration): Declaration<ts.Declaration> | undefined {
    switch (decl.kind) {
      case ts.SyntaxKind.InterfaceDeclaration:
        return new Interface(this, symbol, decl as ts.InterfaceDeclaration);

      case ts.SyntaxKind.ClassDeclaration:
        return new Class(this, symbol, decl as ts.ClassDeclaration);

      case ts.SyntaxKind.FunctionDeclaration:
        return new Function(this, symbol, decl as ts.FunctionDeclaration);

      case ts.SyntaxKind.TypeAliasDeclaration:
        return new TypeAlias(this, symbol, decl as ts.TypeAliasDeclaration);

      case ts.SyntaxKind.EnumDeclaration:
        return new Enum(this, symbol, decl as ts.EnumDeclaration);

      case ts.SyntaxKind.ExportAssignment:
        return new ExportAssignment(this, symbol, decl as ts.ExportAssignment);

      case ts.SyntaxKind.ExportSpecifier:
        return new ExportSpecifier(this, symbol, decl as ts.ExportSpecifier);

      case ts.SyntaxKind.ImportEqualsDeclaration:
        return new ImportEquals(this, symbol, decl as ts.ImportEqualsDeclaration);

      case ts.SyntaxKind.VariableDeclaration:
        return new Variable(this, symbol, decl as ts.VariableDeclaration);

      case ts.SyntaxKind.MethodDeclaration:
        return new StaticMethod(this, symbol, decl as ts.MethodDeclaration);

      case ts.SyntaxKind.FunctionType:
        return new FunctionTypeDeclaration(this, symbol, decl as ts.FunctionTypeNode);

      default:
        console.error('Unsupported declaration kind: ' + ts.SyntaxKind[decl.kind] + ' ' + decl.getText());
        return undefined;
    }
  }

  parseModuleReference(ref: ts.ModuleReference) {
    switch (ref.kind) {
      case ts.SyntaxKind.ExternalModuleReference:
        return {
          kind: 'external',
          expression: ref.expression.getText(),
        };

      case ts.SyntaxKind.QualifiedName:
        return {
          kind: 'qualified',
          left: ref.left.getText(),
          right: ref.right.getText(),
        };

      default:
        throw new Error(`Unsupported module reference kind: ${ts.SyntaxKind[ref.kind]}`);
    }
  }

  parseModifiers(modifiers: ts.NodeArray<ts.ModifierLike> | undefined) {
    if (!modifiers) {
      return [];
    }

    return modifiers.map(m => ts.SyntaxKind[m.kind]);
  }

  parseType(t: ts.TypeNode | undefined): Type<ts.TypeNode> | undefined {
    if (!t) {
      return undefined;
    }

    switch (t.kind) {
      case ts.SyntaxKind.TypeReference:
        return parseTypeReference(this, t as ts.TypeReferenceNode);

      case ts.SyntaxKind.UnionType:
        return new UnionType(this, t as ts.UnionTypeNode);

      case ts.SyntaxKind.ArrayType:
        return new ArrayType(this, t as ts.ArrayTypeNode);

      case ts.SyntaxKind.LiteralType:
        return new LiteralType(this, t as ts.LiteralTypeNode);

      case ts.SyntaxKind.IntersectionType:
        return new IntersectionType(this, t as ts.IntersectionTypeNode);

      case ts.SyntaxKind.TypeLiteral:
        return new TypeLiteral(this, t as ts.TypeLiteralNode);

      case ts.SyntaxKind.FunctionType:
        return new FunctionType(this, t as ts.FunctionTypeNode);

      case ts.SyntaxKind.TupleType:
        return new TupleType(this, t as ts.TupleTypeNode);

      case ts.SyntaxKind.ParenthesizedType:
        return this.parseType((t as ts.ParenthesizedTypeNode).type);

      case ts.SyntaxKind.ConstructorType:
        return new FunctionType(this, t as ts.ConstructorTypeNode);

      case ts.SyntaxKind.TypeQuery:
        return new TypeQuery(this, t as ts.TypeQueryNode);

      case ts.SyntaxKind.ExpressionWithTypeArguments:
        return new ExpressionWithTypeArguments(this, t as ts.ExpressionWithTypeArguments);

      case ts.SyntaxKind.ThisType:
        return new ThisType(this, t as ts.ThisTypeNode);

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
        return new Primitive(this, t);
    }

    console.error('unknown type kind: ' + ts.SyntaxKind[t.kind] + ' ' + t.getText());

    return new UnknownType(this, t);
  }

  parseParameter(p: ts.ParameterDeclaration) {
    return {
      name: p.name.getText(),
      optional: p.questionToken !== undefined,
      type: this.parseType(p.type),
    };
  }

  parseTypeParameter(p: ts.TypeParameterDeclaration) {
    return {
      name: p.name.getText(),
      constraint: this.parseType(ts.getEffectiveConstraintOfTypeParameter(p)),
    };
  }

  parseHeritage(clause: ts.HeritageClause) {
    switch (clause.token) {
      case ts.SyntaxKind.ExtendsKeyword:
        return {
          kind: 'extends',
          types: clause.types.map(t => this.parseType(t)),
        };

      case ts.SyntaxKind.ImplementsKeyword:
        return {
          kind: 'implements',
          types: clause.types.map(t => this.parseType(t)),
        };
    }
  }

  parseMember(d: ts.Declaration): Member<ts.Declaration> {
    switch (d.kind) {
      case ts.SyntaxKind.Constructor:
        return new Method(this, d as ts.MethodDeclaration);

      case ts.SyntaxKind.MethodDeclaration:
        return new Method(this, d as ts.MethodDeclaration);

      case ts.SyntaxKind.PropertyDeclaration:
        return new Property(this, d as ts.PropertyDeclaration);

      case ts.SyntaxKind.PropertySignature:
        return new Property(this, d as ts.PropertySignature);

      case ts.SyntaxKind.IndexSignature:
        return new IndexSignature(this, d as ts.IndexSignatureDeclaration);
    }

    console.error('unknown member kind: ' + ts.SyntaxKind[d.kind]);

    return new UnknownMember(this, d);
  }

  parseTypeElement(d: ts.TypeElement): Member<ts.Declaration> {
    switch (d.kind) {
      case ts.SyntaxKind.PropertySignature:
        return new Property(this, d as ts.PropertySignature);

      case ts.SyntaxKind.MethodSignature:
        return new Method(this, d as ts.MethodSignature);

      case ts.SyntaxKind.CallSignature:
        return new Method(this, d as ts.CallSignatureDeclaration);

      case ts.SyntaxKind.ConstructSignature:
        return new Method(this, d as ts.ConstructSignatureDeclaration);

      case ts.SyntaxKind.IndexSignature:
        return new IndexSignature(this, d as ts.IndexSignatureDeclaration);
    }

    console.error('unknown type element: ' + ts.SyntaxKind[d.kind]);

    return new UnknownMember(this, d);
  }
}

abstract class Declaration<T extends ts.Declaration> {
  name: string;

  constructor(protected parser: Parser, symbol: ts.Symbol, public declaration: T) {
    this.name = symbol.getName();
  }

  abstract json(): any;

  toJSON() {
    return {
      kind: ts.SyntaxKind[this.declaration.kind].replace(/Declaration$/, '').toLocaleLowerCase(),
      name: this.name,
      ...this.json(),
    };
  }
}

class Interface extends Declaration<ts.InterfaceDeclaration> {
  json() {
    return {
      members: this.declaration.members.map(x => this.parser.parseTypeElement(x)),
      heritage: this.declaration.heritageClauses?.map(h => this.parser.parseHeritage(h)),
      typeParameters: this.declaration.typeParameters?.map(p => this.parser.parseTypeParameter(p)),
    };
  }
}

class Class extends Declaration<ts.ClassDeclaration> {
  json() {
    return {
      members: this.declaration.members.map(m => this.parser.parseMember(m)),
      heritage: this.declaration.heritageClauses?.map(h => this.parser.parseHeritage(h)),
      typeParameters: this.declaration.typeParameters?.map(t => this.parser.parseTypeParameter(t)),
    };
  }
}

class Function extends Declaration<ts.FunctionDeclaration | ts.CallSignatureDeclaration> {
  json() {
    return {
      parameters: this.declaration.parameters.map(p => this.parser.parseParameter(p)),
    };
  }
}

class TypeAlias extends Declaration<ts.TypeAliasDeclaration> {
  json() {
    return {
      type: this.parser.parseType(this.declaration.type),
    };
  }
}

class Enum extends Declaration<ts.EnumDeclaration> {
  json() {
    return {
      members: this.declaration.members.map(m => m.name.getText()),
    };
  }
}

class ExportAssignment extends Declaration<ts.ExportAssignment> {
  json() {
    const sym = this.parser.tryFindSymbol(this.declaration.expression.getText());
    let exp;
    if (sym) {
      exp = this.parser.parseSymbol(sym);
    }
    return {
      expression: this.declaration.expression.getText(),
      exp,
    };
  }
}

class ExportSpecifier extends Declaration<ts.ExportSpecifier> {
  json() {
    const exportSpec = this.declaration as ts.ExportSpecifier;
    const propertyName = exportSpec.propertyName?.getText();
    let exp;
    if (propertyName) {
      const propertyType = this.parser.tryFindType(propertyName);
      if (!propertyType) {
        throw new Error(`Could not find property: ${propertyName}`);
      }

      const sym = propertyType.getSymbol();
      if (!sym) {
        throw new Error(`Could not find symbol for property: ${propertyName}`);
      }
      exp = this.parser.parseSymbol(sym);
    }

    return {
      name: this.declaration.name.getText(),
      export: exp,
    };
  }
}

class ImportEquals extends Declaration<ts.ImportEqualsDeclaration> {
  json() {
    return {
      name: this.declaration.name.getText(),
      isTypeOnly: this.declaration.isTypeOnly,
      moduleReference: this.declaration.moduleReference.getText(),
    };
  }
}

class Variable extends Declaration<ts.VariableDeclaration> {
  json() {
    if (this.declaration.type) {
      this.parser.addType(this.declaration.type);
    }

    return {
      name: this.declaration.name.getText(),
      type: this.parser.parseType(this.declaration.type),
      initializer: this.declaration.initializer?.getText(),
    };
  }
}

class StaticMethod extends Declaration<ts.MethodDeclaration> {
  json() {
    return {
      name: this.declaration.name.getText(),
      parameters: this.declaration.parameters.map(p => this.parser.parseParameter(p)),
      modifiers: this.parser.parseModifiers(this.declaration.modifiers),
    };
  }
}

class FunctionTypeDeclaration extends Declaration<ts.FunctionTypeNode> {
  json() {
    return {
      parameters: this.declaration.parameters.map(p => this.parser.parseParameter(p)),
      type: this.parser.parseType(this.declaration.type),
    };
  }
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
  constructor(protected parser: Parser, protected node: T) { }

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

function parseTypeReference(parser: Parser, t: ts.TypeReferenceNode) {
  if ((t.typeArguments ?? []).length > 0) {
    return new GenericTypeReference(parser, t);
  } else {
    return new TypeReference(parser, t);
  }
}

class TypeReference extends Type<ts.TypeReferenceNode> {
  kind: TypeKind = 'ref';

  json() {
    this.parser.addType(this.node);

    return this.node.typeName.getText();
  }
}

class GenericTypeReference extends Type<ts.TypeReferenceNode> {
  kind: TypeKind = 'generic';

  json() {
    return {
      type: this.node.typeName.getText(),
      generic: this.node.typeArguments?.map(t => this.parser.parseType(t)),
    };
  }
}

class UnionType extends Type<ts.UnionTypeNode> {
  kind: TypeKind = 'union';

  json() {
    return this.node.types.map(t => this.parser.parseType(t));
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
      typeArguments: this.node.typeArguments?.map(t => this.parser.parseType(t)),
      exprName: this.node.exprName.getText(),
    };
  }
}

class FunctionType extends Type<ts.FunctionTypeNode | ts.ConstructorTypeNode> {
  kind: TypeKind = 'function';

  json() {
    return {
      parameters: this.node.parameters.map(p => this.parser.parseParameter(p)),
      typeParameters: this.node.typeParameters?.map(t => this.parser.parseTypeParameter(t)),
      return: this.parser.parseType(this.node.type),
    };
  }
}

class TupleType extends Type<ts.TupleTypeNode> {
  kind: TypeKind = 'tuple';

  json() {
    return this.node.elements.map(t => this.parser.parseType(t));
  }
}

class TypeLiteral extends Type<ts.TypeLiteralNode> {
  kind: TypeKind = 'literal';

  json() {
    return {
      members: this.node.members.map(m => this.parser.parseMember(m)),
    };
  }
}

class IntersectionType extends Type<ts.IntersectionTypeNode> {
  kind: TypeKind = 'intersection';

  json() {
    return this.node.types.map(t => this.parser.parseType(t));
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
    return this.parser.parseType(this.node.elementType);
  }
}

class ExpressionWithTypeArguments extends Type<ts.ExpressionWithTypeArguments> {
  kind: TypeKind = 'ref';

  json() {
    return {
      expr: this.node.expression.getText(),
      typeArguments: this.node.typeArguments?.map(t => this.parser.parseType(t)),
    };
  }
}

class ThisType extends Type<ts.ThisTypeNode> {
  kind: TypeKind = 'literal';

  json() {
    return 'this';
  }
}


abstract class Member<T extends ts.Declaration> {
  constructor(protected parser: Parser, protected e: T) {}

  abstract json(): any;

  toJSON() {
    return {
      member: ts.SyntaxKind[this.e.kind].replace(/Declaration$/, '').replace(/Signature$/, '').toLocaleLowerCase(),
      ...this.json(),
    };
  }
}

class UnknownMember extends Member<ts.Declaration> {
  json() {
    return '<unknown-member-kind>';
  }
}

class IndexSignature extends Member<ts.IndexSignatureDeclaration> {
  json() {
    return {
      parameters: this.e.parameters.map(p => this.parser.parseParameter(p)),
      type: this.parser.parseType(this.e.type),
    };
  }
}

class Method extends Member<ts.MethodDeclaration | ts.SignatureDeclarationBase> {
  json() {
    return {
      name: this.e.name?.getText(),
      optional: (this.e as ts.MethodDeclaration).questionToken !== undefined,
      return: this.parser.parseType(this.e.type),
      parameters: this.e.parameters.map(p => this.parser.parseParameter(p)),
    };
  }
}

class Property extends Member<ts.PropertyDeclaration | ts.PropertySignature> {
  json() {
    return {
      name: this.e.name.getText(),
      optional: this.e.questionToken !== undefined,
      type: this.parser.parseType(this.e.type),
    };
  }
}
