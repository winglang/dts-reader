import ts from 'typescript';
import { parseParameter, parseType } from './types';

export function parseMember(d: ts.Declaration): Member<ts.Declaration> {
  switch (d.kind) {
    case ts.SyntaxKind.Constructor:
      return new Method(d as ts.MethodDeclaration);

    case ts.SyntaxKind.MethodDeclaration:
      return new Method(d as ts.MethodDeclaration);

    case ts.SyntaxKind.PropertyDeclaration:
      return new Property(d as ts.PropertyDeclaration);

    case ts.SyntaxKind.PropertySignature:
      return new Property(d as ts.PropertySignature);

    case ts.SyntaxKind.IndexSignature:
      return new IndexSignature(d as ts.IndexSignatureDeclaration);
  }

  console.error('unknown member kind: ' + ts.SyntaxKind[d.kind]);

  return new UnknownMember(d);
}

export function parseTypeElement(d: ts.TypeElement): Member<ts.Declaration> {
  switch (d.kind) {
    case ts.SyntaxKind.PropertySignature:
      return new Property(d as ts.PropertySignature);

    case ts.SyntaxKind.MethodSignature:
      return new Method(d as ts.MethodSignature);

    case ts.SyntaxKind.CallSignature:
      return new Method(d as ts.CallSignatureDeclaration);

    case ts.SyntaxKind.ConstructSignature:
      return new Method(d as ts.ConstructSignatureDeclaration);
  }

  console.error('unknown type element: ' + ts.SyntaxKind[d.kind]);

  return new UnknownMember(d);
}

abstract class Member<T extends ts.Declaration> {
  constructor(protected e: T) { }

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
      parameters: this.e.parameters.map(parseParameter),
      type: parseType(this.e.type),
    };
  }
}

class Method extends Member<ts.MethodDeclaration | ts.SignatureDeclarationBase> {
  json() {
    return {
      name: this.e.name?.getText(),
      optional: (this.e as ts.MethodDeclaration).questionToken !== undefined,
      return: parseType(this.e.type),
      parameters: this.e.parameters.map(parseParameter),
    };
  }
}

class Property extends Member<ts.PropertyDeclaration | ts.PropertySignature> {
  json() {
    return {
      name: this.e.name.getText(),
      optional: this.e.questionToken !== undefined,
      type: parseType(this.e.type),
    };
  }
}
