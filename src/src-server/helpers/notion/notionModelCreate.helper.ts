import {
  GetPageResponse,
  QueryDatabaseParameters,
  QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { notionClient } from "../../notionClient";
import { ValueOf } from "../../types/common";
import { FieldType, FieldTypeObject, FieldTypeUnion } from "../../types/notion";

interface NotionModelCreateProps<K extends string> {
  title: string;
  databaseId: string;
  field: Record<K, FieldTypeUnion>;
}

export function notionModelCreate<
  F extends string,
  FN extends Record<F | "_id", string>
>(args: NotionModelCreateProps<F>): Model<F, FN> {
  return new Model<F, FN>(args);
}

// for get
function FieldTypeNormalizing(res: ValueOf<FieldTypeObject>) {
  try {
    const defineFieldTypeNormalizing = Object.keys(FieldTypeNormalizingObject);
    if (!defineFieldTypeNormalizing.includes(res.type)) {
      console.log("undefined FieldTypeNormalizing");
      return "";
    }

    return FieldTypeNormalizingObject[res.type](res as any);
  } catch (error) {
    console.log(error);
  }
}
const FieldTypeNormalizingObject = {
  rich_text: (res: FieldType<"rich_text">): string => {
    return res.rich_text.length ? res.rich_text[0].plain_text : "";
  },
  title: (res: FieldType<"title">): string => {
    return res.title.length ? res.title[0].plain_text : "";
  },
  select: (res: FieldType<"select">): string => {
    return res.select.name;
  },
  multi_select: (res: FieldType<"multi_select">): string[] => {
    return res.multi_select.map((s) => s.name);
  },
  files: (res: FieldType<"files">): string[] => {
    return res.files.map((f) =>
      f.type === "external" ? f.external.url : f.file.url
    );
  },
};

// for post
const CreateFieldTypeObject = {
  title: (value: string) => ({
    type: "title" as const,
    title: [{ type: "text" as const, text: { content: value } }],
  }),
  rich_text: (value: string) => ({
    type: "rich_text" as const,
    rich_text: [{ type: "text" as const, text: { content: value } }],
  }),
  select: (value: string) => ({
    type: "select" as const,
    select: { name: value },
  }),
  files: (value: string) => ({
    type: "files" as const,
    files: [
      {
        type: "external" as const,
        name: value.split("/").pop(),
        external: { url: value },
      },
    ],
  }),
  multi_select: (value: string[]) => ({
    type: "multi_select" as const,
    multi_select: { options: value.map((select) => ({ name: select })) },
  }),
};

class Model<F extends string, FN extends Record<F | "_id", string | string[]>> {
  private readonly title: string;
  private readonly databaseId: string;
  private readonly uniqueFiledName: null | string;
  private readonly field: { [key: string]: FieldTypeUnion };

  constructor({ title, databaseId, field }: NotionModelCreateProps<F>) {
    this.title = title;
    this.databaseId = databaseId;
    this.field = field;
    this.uniqueFiledName =
      Object.entries(field).find(([_, value]) => value === "title")?.[0] ??
      null;
  }

  private normalizingQueryRes(res: QueryDatabaseResponse) {
    if (!res.results.length || !("properties" in res.results[0])) return null;
    const properties = res.results[0].properties;

    return Object.keys(this.field).reduce<FN>(
      (results, filedName) => ({
        ...results,
        [filedName]: FieldTypeNormalizing(
          properties[filedName] as ValueOf<FieldTypeObject>
        ),
      }),
      { _id: res.results[0].id } as FN
    );
  }

  private normalizingPageRes(res: GetPageResponse) {
    if (!("properties" in res)) return null;
    const properties = res.properties;

    return Object.keys(this.field).reduce<FN>(
      (results, filedName) => ({
        ...results,
        [filedName]: FieldTypeNormalizing(
          properties[filedName] as ValueOf<FieldTypeObject>
        ),
      }),
      { _id: res.id } as FN
    );
  }

  private normalizingCreateField(filed: Record<F, string | string[]>) {
    return Object.keys(filed).reduce((results, filedName) => {
      const value = filed[filedName as F];
      const filedType = this.field[filedName];

      return {
        ...results,
        [filedName]: CreateFieldTypeObject[filedType](
          value as string & string[]
        ),
      };
    }, {});
  }

  public async create(filed: Record<F, string | string[]>) {
    try {
      const res = await notionClient.pages.create({
        parent: { database_id: this.databaseId },
        properties: this.normalizingCreateField(filed),
      });

      return this.normalizingPageRes(res);
    } catch (error) {
      console.log({ error });
      return null;
    }
  }

  public async get() {
    const res = await notionClient.databases.query({
      database_id: this.databaseId,
    });
    return this.normalizingQueryRes(res);
  }

  public async query(args: Omit<QueryDatabaseParameters, "database_id">) {
    const res = await notionClient.databases.query({
      database_id: this.databaseId,
      ...args,
    });
    return this.normalizingQueryRes(res);
  }

  public async findOneById(id: string) {
    try {
      const res = await notionClient.pages.retrieve({ page_id: id });

      return this.normalizingPageRes(res);
    } catch (error) {
      console.log({ error });
      return null;
    }
  }

  public async findOneByUniqueFiled(value: string) {
    if (!this.uniqueFiledName) return null;

    const res = await notionClient.databases.query({
      database_id: this.databaseId,
      filter: { property: this.uniqueFiledName, title: { equals: value } },
    });

    return this.normalizingQueryRes(res);
  }
}
