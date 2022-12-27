import ts from 'typescript';
import { parseMember, parseTypeElement } from './members';
import { parseParameter, parseType, parseTypeParameter } from './types';

export class Parser {
  public checker: ts.TypeChecker;
  public sourceFile: ts.SourceFile;
  private filePath: string;

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

  parse(): Declaration<ts.Declaration>[] {
    const sourceFileSymbol = this.checker.getSymbolAtLocation(this.sourceFile);
    if (!sourceFileSymbol) {
      throw new Error(`Could not find source file symbol: ${this.filePath}`);
    }
    const exports = this.checker.getExportsOfModule(sourceFileSymbol);
    const types = exports.map(e => this.parseSymbol(e)).flat();
    return types;
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
      console.log(decl.getText());
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

    return modifiers.map((m) => ts.SyntaxKind[m.kind]);
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
      members: this.declaration.members.map(parseTypeElement),
      heritage: this.declaration.heritageClauses?.map(parseHeritage),
      typeParameters: this.declaration.typeParameters?.map(parseTypeParameter),
    };
  }
}

class Class extends Declaration<ts.ClassDeclaration> {
  json() {
    return {
      members: this.declaration.members.map(m => parseMember(m)),
      heritage: this.declaration.heritageClauses?.map(parseHeritage),
      typeParameters: this.declaration.typeParameters?.map(parseTypeParameter),
    };
  }
}

class Function extends Declaration<ts.FunctionDeclaration | ts.CallSignatureDeclaration> {
  json() {
    return {
      parameters: this.declaration.parameters.map(parseParameter),
    };
  }
}

class TypeAlias extends Declaration<ts.TypeAliasDeclaration> {
  json() {
    return {
      type: parseType(this.declaration.type),
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
    return {
      expression: this.declaration.expression.getText(),
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
    const ref = this.parser.parseModuleReference(this.declaration.moduleReference);
    console.log({ ref });
    // const sym = this.parser.tryFindSymbol(this.declaration.moduleReference);
    // if (!sym) {
    //   throw new Error(`Could not find symbol: ${this.declaration.moduleReference.getText()}`);
    // }

    return {
      name: this.declaration.name.getText(),
      isTypeOnly: this.declaration.isTypeOnly,
      moduleReference: this.declaration.moduleReference.getText(),
    };
  }
}

class Variable extends Declaration<ts.VariableDeclaration> {
  json() {
    return {
      name: this.declaration.name.getText(),
      type: parseType(this.declaration.type),
      initializer: this.declaration.initializer?.getText(),
    };
  }
}

class StaticMethod extends Declaration<ts.MethodDeclaration> {
  json() {
    return {
      name: this.declaration.name.getText(),
      parameters: this.declaration.parameters.map(parseParameter),
      modifiers: this.parser.parseModifiers(this.declaration.modifiers),
    };
  }
}

function parseHeritage(clause: ts.HeritageClause) {
  switch (clause.token) {
    case ts.SyntaxKind.ExtendsKeyword:
      return {
        kind: 'extends',
        types: clause.types.map(parseType),
      };

    case ts.SyntaxKind.ImplementsKeyword:
      return {
        kind: 'implements',
        types: clause.types.map(parseType),
      };
  }
}
