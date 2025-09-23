from pydantic import BaseModel


class GenerateMixTwoResponse(BaseModel):
    output_image_path: str
    metadata_path: str
    parents: list[str]
    model_name: str


